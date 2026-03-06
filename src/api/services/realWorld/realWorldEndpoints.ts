// src/api/services/realWorld/realWorldEndpoints.ts

import { BaseService } from "../baseService.js";
import { APIResponse } from "@playwright/test";
import { ApiClient } from "../../client.js";
import { logger } from "../../../sharedUtils/logger.js";

/**
 * Service class for RealWorld API endpoints.
 * Extends BaseService to inherit common API functionality.
 * 
 * @class realWorldService
 * @extends BaseService
 */
export class realWorldService extends BaseService {
  /**
   * Base path for RealWorld API endpoints
   * @protected
   * @type {string}
   * @description Implements abstract basePath from BaseService. Used for path concatenation.
   */
  protected basePath: string;

  /**
   * @constructor
   * @param {ApiClient} apiClient - API client for HTTP requests
   * @param {string} basePath - Base path for API endpoints (e.g., "/api")
   * 
   * @description
   * Calls parent constructor with injected dependencies.
   * Sets basePath for this service.
   */
  constructor(apiClient: ApiClient, basePath: string) {
    super(apiClient);
    this.basePath = basePath;
  }

  /**
   * Registers a new user account.
   * 
   * @method registerUser
   * @async
   * @public
   * 
   * @param {object} payload - User registration data
   * 
   * @returns {Promise<APIResponse>} Response with user data and token
   * 
   * @description
   * POST to /users endpoint.
   * Uses callApi (baseURL + basePath + "users").
   */
  async registerUser(payload: object): Promise<APIResponse> {
    return this.callApi({
      method: "POST",
      path_param: "users",
      payload: payload
    });
  }

  /**
   * Authenticates user and returns token.
   * 
   * @method loginUser
   * @async
   * @public
   * 
   * @param {object} payload - User login credentials
   * 
   * @returns {Promise<APIResponse>} Response with user data and token
   * 
   * @description
   * POST to /users/login endpoint.
   * Uses callApi (baseURL + basePath + "users/login").
   */
  async loginUser(payload: object): Promise<APIResponse> {
    return this.callApi({
      method: "POST",
      path_param: "users/login",
      payload: payload
    });
  }

  /**
   * Creates a new article.
   * 
   * @method createArticle
   * @async
   * @public
   * 
   * @param {object} payload - Article data
   * @param {Record<string, string>} headers - Request headers (auth token)
   * 
   * @returns {Promise<APIResponse>} Response with created article data
   * 
   * @description
   * POST to /articles endpoint.
   * Requires authentication token in headers.
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
   * Fetches list of articles with optional filters.
   * 
   * @method getArticles
   * @async
   * @public
   * 
   * @param {object} [filters] - Optional query filters
   * 
   * @returns {Promise<APIResponse>} Response with articles array
   * 
   * @description
   * GET to /articles endpoint with query parameters.
   * Uses callApi with query_params.
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

  /**
   * Fetches user data from external JSONPlaceholder API.
   * 
   * @method getExternalUser
   * @async
   * @public
   * 
   * @param {number} userId - User ID to fetch
   * 
   * @returns {Promise<APIResponse>} Response with external user data
   * 
   * @description
   * GET to JSONPlaceholder API.
   * Uses callDirectApi (full URL, no baseURL).
   */
  async getExternalUser(userId: number): Promise<APIResponse> {
    return this.callDirectApi({
      url: `https://jsonplaceholder.typicode.com/users/${userId}`,
      method: "GET"
    });
  }

  /**
   * Calls external webhook with event data.
   * 
   * @method callWebhook
   * @async
   * @public
   * 
   * @param {string} webhookUrl - Full webhook URL
   * @param {object} payload - Event payload to send
   * 
   * @returns {Promise<APIResponse>} Response from webhook
   * 
   * @description
   * POST to external webhook.
   * Uses callDirectApi (full URL, no baseURL).
   */
  async callWebhook(webhookUrl: string, payload: object): Promise<APIResponse> {
    return this.callDirectApi({
      url: webhookUrl,
      method: "POST",
      payload: payload
    });
  }

  /**
   * Searches GitHub repositories.
   * 
   * @method searchGitHubRepos
   * @async
   * @public
   * 
   * @param {string} query - Search query
   * @param {string} [sort] - Sort order (default: "stars")
   * 
   * @returns {Promise<APIResponse>} Response with search results
   * 
   * @description
   * GET to GitHub API.
   * Uses callDirectApi with query parameters.
   */
  async searchGitHubRepos(query: string, sort: string = "stars"): Promise<APIResponse> {
    return this.callDirectApi({
      url: "https://api.github.com/search/repositories",
      method: "GET",
      query_params: { q: query, sort, order: "desc" },
      headers: { "Accept": "application/vnd.github.v3+json" }
    });
  }
}