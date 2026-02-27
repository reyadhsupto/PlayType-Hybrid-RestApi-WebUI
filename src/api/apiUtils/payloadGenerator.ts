import {DynamicDataGenerator as dataGenerator} from "../../sharedUtils/dataGenerator.js"


/**
 * Class that contains static methods to generate payloads using dataGenerator
 * Usage:
 *       Inside Test Cases, while calling POST, PUT, PATCH endpoints
 * Accepts @Params 
 * Returns Json objects as payloads
 */ 
export class DataGenerator {

  //Payload for Register User
  static registerUser(){
    return {
      user: {
        username: `testuser${dataGenerator.replaceSymbols("???????")}`,
        email: `tester${dataGenerator.replaceSymbols("???????")}@gmail.com`,
        password: "password"
      }
    }
  }

  //Payload for Login User
  static loginUser(email:string, password:string){
    return {
      user: {
        email: email,
        password: password
      }
    }
  }  
}
