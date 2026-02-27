import { request, APIRequestContext } from "@playwright/test";
import { ApiClient } from "../src/api/client.js";
import { DatabaseService } from "../src/sharedUtils/dbClient.js"
import { logger, runLogFile } from "../src/sharedUtils/logger.js"
import { Validator } from "../src/api/validator.js";
import { DataGenerator } from "../src/api/apiUtils/payloadGenerator.js";
import { realWorldService } from "../src/api/services/realWorld/realWorldEndpoints.js";
import config from "../src/sharedUtils/config.js"
import * as allure from "allure-js-commons";

import * as fs from 'fs';
import * as path from 'path';

let envConfig = config;
if(config.useConsul){
    const runtimeConfigPath = path.join(process.cwd(), "runtime-config.json");
    envConfig = JSON.parse(fs.readFileSync(runtimeConfigPath, "utf-8"));
}

export class BaseTest {
    static requestContext: APIRequestContext;
    static apiClient: ApiClient;
    static logger = logger;
    static validator = Validator;
    static generator = DataGenerator;
    static env_config = config;
    static rw = new realWorldService();
    static DbC = DatabaseService;
    static allure = allure;

    static async setup(baseUrl: string, headers?: Record<string, string>) {
        this.requestContext = await request.newContext({ 
        baseURL: baseUrl ,
        extraHTTPHeaders: {
            "Content-Type": "application/json",
            ...(headers ?? {})
        }});
        this.apiClient = new ApiClient(this.requestContext, baseUrl);
        this.logger.info("BaseTest setup: requestCOntext, apiClient completed");
    }

    static async teardown() {
        await this.requestContext?.dispose();
        this.logger.info("BaseTest teardown:requestCOntext dispose  done");
        this.logger.info(`Test completed, logs at: ${runLogFile}\n\n`);
    }

    static logTestTitle( message: string, testTitle: string){
        const title = testTitle || "Unknown Test";
        this.logger.info(`${message} : [${title}]`);
    }

}
