import {BaseService} from "../baseService.js"
import { APIResponse } from "@playwright/test";
import config from "../../../sharedUtils/config.js"


export class realWorldService extends BaseService {
  protected basePath = config.api_base_path; //base path for x service endpoints eg. api/v1

  /**
   * Endpoint for user registration
   * @param method Expected api method
   * @param payload Expected json payload 
   * @returns APIResponse 
   */
  async registerUser(
    payload: object
  ): Promise<APIResponse> {
        return this.callApi(
        {
            method : "POST",
            path_param: "users",      // no extra pathParam, uses basePath
            payload : payload
        }
    );
  }

  /**
   * Endpoint for user login
   * @param method Expected api method
   * @param payload Expected json payload 
   * @returns APIResponse 
   */
  async loginUser(
    payload: object
  ): Promise<APIResponse> {
        return this.callApi(
        {
            method : "POST",
            path_param: "users/login",      // no extra pathParam, uses basePath
            payload : payload
        }
    );
  }

  /**
   * Endpoint for quest creation
   * @param method Expected api method
   * @param path_param Expected path param eg. /quests/{id}
   * @returns APIResponse 
   */
  async createArticle(
    payload: object, headers: Record <string, string>
  ): Promise<APIResponse> {
        return this.callApi(
        {
            method : "POST",
            path_param: "articles",
            payload:  payload ,    // using only relative path
            headers: headers
        }
    );
  }
}