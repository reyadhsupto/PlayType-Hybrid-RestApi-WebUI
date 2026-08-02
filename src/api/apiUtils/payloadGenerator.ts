import { DynamicDataGenerator as dataGenerator } from "../../sharedUtils/dataGenerator.js";
import { logger } from "../../sharedUtils/logger.js";

/**
 * Single addon choice returned by the item detail endpoint.
 */
export type RestaurantAddonItem = {
  id: string;
  item_name?: string;
  price?: number;
  final_price?: number;
};

/**
 * Addon group returned by the item detail endpoint.
 */
export type RestaurantAddonGroup = {
  addon_name?: string;
  items?: RestaurantAddonItem[];
  count?: number;
};

/**
 * Restaurant menu item returned by the restaurant list endpoint.
 */
export type RestaurantMenuItem = {
  id: string;
  name?: string;
  has_addon?: boolean;
  priority?: number;
  addons_required?: RestaurantAddonGroup[];
  addons_optional?: RestaurantAddonGroup[];
};

/**
 * Restaurant menu section returned by the list endpoint.
 */
export type RestaurantMenuSection = {
  category?: string;
  details?: {
    name?: string;
    icon?: string | null;
  };
  items?: RestaurantMenuItem[];
};

/**
 * Normalized calculate bill item payload.
 */
export type CalculateBillItemPayload = {
  id: string;
  addons_optional: string[];
  quantity: number;
  addons_required: string[];
};

/**
 * Final calculate bill payload.
 */
export type CalculateBillPayload = {
  city: number;
  delivery_mode: string;
  is_priority_delivery: boolean;
  items: CalculateBillItemPayload[];
  drop_off_lat: number;
  drop_off_lon: number;
  promo_code: string;
  restaurant: string;
};

/**
 * Input accepted by the calculate bill payload builder.
 */
export type BuildCalculateBillPayloadInput = {
  restaurantItemsResponse: unknown;
  restaurant: string;
  city: number;
  dropOffLat: number;
  dropOffLon: number;
  deliveryMode?: string;
  isPriorityDelivery?: boolean;
  promoCode?: string;
  maxItems?: number;
  minQuantity?: number;
  maxQuantity?: number;
  includeOptionalAddons?: boolean;
  allowAddonFallback?: boolean;
  fetchItemDetails?: (itemId: string) => Promise<RestaurantMenuItem | undefined>;
};

/**
 * Class that contains static methods to generate payloads using helper methods.
 *
 * Usage:
 * - inside tests while calling POST, PUT, PATCH endpoints
 * - build bill payloads from restaurant menu responses
 * - keep payload creation logic out of specs
 */
export class DataGenerator {
  /**
   * Build the payload for registering a user.
   *
   * @returns A register user payload object
   */
  static registerUser() {
    return {
      user: {
        username: `testuser${dataGenerator.replaceSymbols("???????")}`,
        email: `tester${dataGenerator.replaceSymbols("???????")}@gmail.com`,
        password: "password",
      },
    };
  }

  /**
   * Build the payload for logging in a user.
   *
   * @param email - User email
   * @param password - User password
   * @returns A login user payload object
   */
  static loginUser(email: string, password: string) {
    return {
      user: {
        email,
        password,
      },
    };
  }

  /**
   * Build a calculate bill payload from a full restaurant menu response.
   *
   * The builder:
   * - flattens the restaurant response into items
   * - prefers items without addons
   * - selects up to `maxItems`
   * - assigns a random quantity between 1 and 3 by default
   * - resolves addon detail only when a callback is provided
   *
   * @param input - Restaurant response and payload metadata
   * @returns A calculate bill payload ready to send to the API
   */
  static async buildCalculateBillPayload(
    input: BuildCalculateBillPayloadInput
  ): Promise<CalculateBillPayload> {
    const {
      restaurantItemsResponse,
      restaurant,
      city,
      dropOffLat,
      dropOffLon,
      deliveryMode = "HOME_DELIVERY",
      isPriorityDelivery = false,
      promoCode = "",
      maxItems = 3,
      minQuantity = 1,
      maxQuantity = 3,
      includeOptionalAddons = false,
      allowAddonFallback = false,
      fetchItemDetails,
    } = input;

    const allItems = this.extractRestaurantItems(restaurantItemsResponse);
    if (allItems.length === 0) {
      throw new Error("No restaurant items were found in the response");
    }

    const selectedItems = await this.pickItemsForBill({
      allItems,
      maxItems,
      allowAddonFallback,
      fetchItemDetails,
    });

    if (selectedItems.length === 0) {
      throw new Error("No eligible restaurant items were found for calculate bill payload");
    }

    if (selectedItems.length < maxItems) {
      logger.warn(
        `Only ${selectedItems.length} restaurant items were selected for calculate bill payload because fewer eligible no-addon items were available`
      );
    }

    return {
      city,
      delivery_mode: deliveryMode,
      is_priority_delivery: isPriorityDelivery,
      items: await Promise.all(
        selectedItems.map((item) =>
          this.buildCalculateBillItem({
            item,
            minQuantity,
            maxQuantity,
            includeOptionalAddons,
            fetchItemDetails,
          })
        )
      ),
      drop_off_lat: dropOffLat,
      drop_off_lon: dropOffLon,
      promo_code: promoCode,
      restaurant,
    };
  }

  /**
   * Convert the restaurant menu response into a flat item list.
   *
   * @param restaurantItemsResponse - Full restaurant menu response
   * @returns Flat list of menu items
   */
  private static extractRestaurantItems(restaurantItemsResponse: unknown): RestaurantMenuItem[] {
    const rawResponse = restaurantItemsResponse as {
      items?: RestaurantMenuItem[];
      categories?: RestaurantMenuSection[];
      data?: RestaurantMenuSection[];
    };

    if (Array.isArray(restaurantItemsResponse)) {
      return restaurantItemsResponse.flatMap((section) => {
        const typedSection = section as RestaurantMenuSection;
        return Array.isArray(typedSection.items) ? typedSection.items : [];
      });
    }

    if (Array.isArray(rawResponse.items)) {
      return rawResponse.items;
    }

    if (Array.isArray(rawResponse.categories)) {
      return rawResponse.categories.flatMap((section) => (Array.isArray(section.items) ? section.items : []));
    }

    if (Array.isArray(rawResponse.data)) {
      return rawResponse.data.flatMap((section) => (Array.isArray(section.items) ? section.items : []));
    }

    return [];
  }

  /**
   * Select restaurant items for the calculate bill payload.
   *
   * Preference order:
   * - no-addon items first
   * - addon items only if a detail resolver is available and we still need more items
   *
   * @param input - Selection options
   * @returns Selected menu items
   */
  private static async pickItemsForBill(input: {
    allItems: RestaurantMenuItem[];
    maxItems: number;
    allowAddonFallback: boolean;
    fetchItemDetails?: (itemId: string) => Promise<RestaurantMenuItem | undefined>;
  }): Promise<RestaurantMenuItem[]> {
    const { allItems, maxItems, allowAddonFallback, fetchItemDetails } = input;
    const selectedItems: RestaurantMenuItem[] = [];

    const noAddonItems = allItems.filter((item) => item.has_addon !== true);
    selectedItems.push(...noAddonItems.slice(0, maxItems));

    if (selectedItems.length >= maxItems || !allowAddonFallback || !fetchItemDetails) {
      return selectedItems;
    }

    const addonCandidates = allItems.filter(
      (item) => item.has_addon === true && !selectedItems.some((selected) => selected.id === item.id)
    );

    for (const candidate of addonCandidates) {
      if (selectedItems.length >= maxItems) {
        break;
      }

      const detail = await fetchItemDetails(candidate.id);
      selectedItems.push({
        ...candidate,
        ...(detail ?? {}),
        id: candidate.id,
        has_addon: true,
      });
    }

    return selectedItems.slice(0, maxItems);
  }

  /**
   * Build one calculate bill line item.
   *
   * @param input - Item data and addon resolution options
   * @returns One normalized bill line item
   */
  private static async buildCalculateBillItem(input: {
    item: RestaurantMenuItem;
    minQuantity: number;
    maxQuantity: number;
    includeOptionalAddons: boolean;
    fetchItemDetails?: (itemId: string) => Promise<RestaurantMenuItem | undefined>;
  }): Promise<CalculateBillItemPayload> {
    const { item, minQuantity, maxQuantity, includeOptionalAddons, fetchItemDetails } = input;
    const itemDetails = item.has_addon ? await fetchItemDetails?.(item.id) : undefined;
    const resolvedItem = itemDetails ?? item;

    return {
      id: item.id,
      addons_optional: this.resolveAddonIds(resolvedItem.addons_optional, includeOptionalAddons),
      quantity: dataGenerator.integer(minQuantity, maxQuantity),
      addons_required: this.resolveAddonIds(resolvedItem.addons_required, true),
    };
  }

  /**
   * Resolve addon ids from addon groups.
   *
   * @param groups - Required or optional addon groups
   * @param shouldInclude - Whether the groups should be included in the payload
   * @returns Flattened addon id list
   */
  private static resolveAddonIds(groups: RestaurantAddonGroup[] | undefined, shouldInclude: boolean): string[] {
    if (!shouldInclude || !Array.isArray(groups) || groups.length === 0) {
      return [];
    }

    return groups.flatMap((group) => {
      const count = Math.max(1, Number(group.count) || 1);
      const items = Array.isArray(group.items) ? group.items : [];
      return items.slice(0, count).map((item) => item.id);
    });
  }
}
