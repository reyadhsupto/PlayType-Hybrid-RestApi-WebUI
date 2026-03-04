// src/api/services/realWorld/realWorldEndpoints.ts

import {BaseService} from "../baseService.js"
import { APIResponse } from "@playwright/test";
import config from "../../../sharedUtils/config.js"

export class realWorldService extends BaseService {
  protected basePath = config.api_base_path; // e.g., "/api"

  // ========== USING callApi (uses baseURL from setup) ==========

  /**
   * User registration
   */
  async registerUser(payload: object): Promise<APIResponse> {
    return this.callApi({
      method: "POST",
      path_param: "users",
      payload: payload
    });
  }

  /**
   * User login
   */
  async loginUser(payload: object): Promise<APIResponse> {
    return this.callApi({
      method: "POST",
      path_param: "users/login",
      payload: payload
    });
  }

  /**
   * Create article
   */
  async createArticle(payload: object, headers: Record<string, string>): Promise<APIResponse> {
    return this.callApi({
      method: "POST",
      path_param: "articles",
      payload: payload,
      headers: headers
    });
  }

  /**
   * Get articles with filters
   */
  async getArticles(filters?: {
    tag?: string;
    author?: string;
    favorited?: string;
    limit?: number;
    offset?: number;
  }): Promise<APIResponse> {
    return this.callApi({
      method: "GET",
      path_param: "articles",
      query_params: filters as any
    });
  }

  // ========== USING directCall (standalone, full URL required) ==========

  /**
   * Call external webhook (no baseURL needed)
   */
  async callWebhook(webhookUrl: string, payload: object): Promise<APIResponse> {
    return this.callDirectApi({
      url: webhookUrl,
      method: "POST",
      payload: payload
    });
  }

  /**
   * Get external user data from JSONPlaceholder
   */
  async getExternalUser(userId: number): Promise<APIResponse> {
    return this.callDirectApi({
      url: `https://jsonplaceholder.typicode.com/users/${userId}`,
      method: "GET"
    });
  }

  /**
   * Search GitHub repositories (external API)
   */
  async searchGitHubRepos(query: string, sort: string = "stars"): Promise<APIResponse> {
    return this.callDirectApi({
      url: "https://api.github.com/search/repositories",
      method: "GET",
      query_params: { q: query, sort, order: "desc" },
      headers: { "Accept": "application/vnd.github.v3+json" }
    });
  }

  /**
   * Get weather data from external API
   */
  async getWeather(city: string, apiKey: string): Promise<APIResponse> {
    return this.callDirectApi({
      url: "https://api.openweathermap.org/data/2.5/weather",
      method: "GET",
      query_params: { q: city, appid: apiKey }
    });
  }

  /**
   * Post to external analytics service
   */
  async trackEvent(analyticsUrl: string, event: object): Promise<APIResponse> {
    return this.callDirectApi({
      url: analyticsUrl,
      method: "POST",
      payload: event,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": "your-api-key"
      }
    });
  }

  /**
   * Get data from a different microservice (different domain)
   */
  async getOrdersFromOrderService(orderId: string): Promise<APIResponse> {
    return this.callDirectApi({
      url: `https://orders-service.example.com/api/v1/orders/${orderId}`,
      method: "GET",
      headers: {
        "Authorization": "Bearer service-token"
      }
    });
  }

  /**
   * Call third-party payment gateway
   */
  async processPayment(paymentGatewayUrl: string, paymentData: object, apiKey: string): Promise<APIResponse> {
    return this.callDirectApi({
      url: paymentGatewayUrl,
      method: "POST",
      payload: paymentData,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });
  }
}