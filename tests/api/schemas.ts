// tests/schemas.ts

import { z } from "zod";

export const registerUserSchemaZod = z.object({
  user: z.object({
    username: z.string(),
    email: z.email(),
    bio: z.string().nullable(),
    image: z.string().nullable(),
    token: z.string()
  })
});

export const loginUserSchema = z.object({
  user: z.object({
    username: z.string(),
    email: z.email(),
    bio: z.string().nullable(),
    image: z.string().nullable(),
    token: z.string()
  })
})

export const updateQuestStatusSchema = 
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
    }
  },
  "required": ["message"]
}




export * from "./schemas.js";
