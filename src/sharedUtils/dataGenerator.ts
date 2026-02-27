/** 
 * Class containing static methods returning fake data
 * Uses faker.js to generate random data
 * Used in API Tests
*/

import { faker } from "@faker-js/faker";

export class DynamicDataGenerator {
  // Returns a string with replaced symbols (e.g., random alphanumeric)
  static replaceSymbols(pattern: string) {
    return faker.helpers.replaceSymbols(pattern);
  }

  // Returns a random paragraph
  static paragraph() {
    return faker.lorem.paragraph();
  }

  // Returns a random integer between min and max
  static integer(min: number = 0, max: number = 1000) {
    return faker.number.int({ min, max });
  }

  // Returns a random float between min and max
  static float(min: number = 0, max: number = 1000, precision: number = 2) {
    return parseFloat(faker.number.float({ min, max }).toFixed(precision));
  }

  // Returns a random number (int or float)
  static number(min: number = 0, max: number = 1000) {
    return faker.number.int({ min, max });
  }

  // Returns current UTC time as ISO string after interval minutes
  static utcNow_minutesInterval(interval: number) {
    return new Date(new Date(Date.now() + interval  * 60 * 1000).setSeconds(0, 0)).toISOString();
  }

// Returns current UTC time as ISO string after interval hours
  static utcNow_hourInterval(interval: number) {
    return new Date(new Date(Date.now() + interval  * 60 *60 * 1000).setSeconds(0, 0)).toISOString();
  }

  // Returns current local time as ISO string after interval minutes
  static localNow_minutesInterval(interval: number) {
    return new Date(new Date(Date.now() + interval * 60 * 1000).setSeconds(0, 0)).toLocaleString();
  }

// Returns current local time as ISO string after interval hours
  static localNow_hourInterval(interval: number) {
    return new Date(new Date(Date.now() + interval * 60 * 60 * 1000).setSeconds(0, 0)).toLocaleString();
  }

  // Returns a random sentence
  static sentence() {
    return faker.lorem.sentence();
  }

  // Returns a random word
  static word() {
    return faker.lorem.word();
  }

  // Returns a random UUID
  static uuid() {
    return faker.string.uuid();
  }
}

