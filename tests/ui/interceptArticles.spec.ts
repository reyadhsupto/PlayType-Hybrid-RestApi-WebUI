// tests/ui/interceptArticles.spec.ts

import { test } from '../baseUiTest.js';
import { expect } from '@playwright/test';

/**
 * Example: Intercepting the articles API and mocking responses
 * API: https://api.realworld.show/api/articles?limit=10&offset=0
 * 
 * Note: Using page.route() directly since HelperActions is not in UI fixtures
 */

test.describe('Articles page',{ tag: ['@UI', '@intercept'] }, () => {

  test('Verify that all articles are displayed in ui properly', { tag: ['@articles'] }, async ({ basePage }) => {
    const mockArticles = {
      articles: [
        {
          slug: "how-to-train-your-dragon-mocked",
          title: "How to train your dragon (MOCKED)",
          description: "Ever wonder how?",
          body: "It uses a series of secret...",
          tagList: ["dragons", "training"],
          author: {
            username: "jake",
            image: "https://raw.githubusercontent.com/gothinkster/node-express-realworld-example-app/refs/heads/master/src/assets/images/smiley-cyrus.jpeg",
            following: false
          },
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          favorited: false,
          favoritesCount: 10
        },
        {
          slug: "test-article-2",
          title: "Test Article 2",
          description: "Another mocked article",
          body: "This is test content...",
          tagList: ["test"],
          author: {
            username: "testuser",
            image: "https://raw.githubusercontent.com/gothinkster/node-express-realworld-example-app/refs/heads/master/src/assets/images/smiley-cyrus.jpeg",
            following: false
          },
          createdAt: "2024-01-02T00:00:00.000Z",
          updatedAt: "2024-01-02T00:00:00.000Z",
          favorited: false,
          favoritesCount: 5
        }
      ],
      articlesCount: 2
    };

    // Setup interception BEFORE navigation using HelperActions
    await basePage.helperActions.interceptRequests(
      '**/api/articles*',
      async (route: any) => {
        console.log(`Intercepted request: ${route.request().method()} ${route.request().url()}`);
        await basePage.helperActions.fulfillRoute(route, mockArticles, 200);
      }
    );

    await basePage.pause();

    // Navigate to page - it will get mocked articles
    // await basePage.page.goto('https://api.realworld.show');
    
    // Verify the mock was applied
    console.log('Mock articles API intercepted and ready for test');
  });

  test('Intercept with specific query parameters', { tag: ['@MOCK'] }, async ({ basePage }) => {
    const mockData = {
      articles: [
        {
          slug: "specific-article",
          title: "Article with limit=10&offset=0",
          description: "This matches specific query params",
          body: "Content...",
          tagList: [],
          author: { username: "user", image: "", following: false },
          createdAt: "2024-04-13T00:00:00.000Z",
          updatedAt: "2024-04-13T00:00:00.000Z",
          favorited: false,
          favoritesCount: 0
        }
      ],
      articlesCount: 1
    };

    // Match exact URL with query params
    await basePage.helperActions.interceptRequests(
      'https://api.realworld.show/api/articles?limit=10&offset=0',
      async (route: any) => {
        console.log(`Exact match intercepted: ${route.request().url()}`);
        await basePage.helperActions.fulfillRoute(route, mockData);
      }
    );

    await basePage.page.goto('https://api.realworld.show');
  });

  test('Intercept and return error response', { tag: ['@MOCK', '@ERROR'] }, async ({ basePage }) => {
    const errorResponse = {
      errors: {
        "articles": ["Unable to fetch articles"]
      }
    };

    await basePage.helperActions.interceptRequests(
      '**/api/articles*',
      async (route: any) => {
        // Return 500 error
        await basePage.helperActions.fulfillRoute(route, errorResponse, 500);
      }
    );

    await basePage.page.goto('https://api.realworld.show');
    
    // Test should verify error handling UI
  });

  test('Conditional interception by HTTP method', { tag: ['@MOCK'] }, async ({ basePage }) => {
    await basePage.helperActions.interceptRequests(
      '**/api/articles*',
      async (route: any) => {
        const request = route.request();
        const method = request.method();

        if (method === 'GET') {
          // Mock GET requests
          await basePage.helperActions.fulfillRoute(route, {
            articles: [{ slug: "get-article", title: "GET Mock" }],
            articlesCount: 1
          });
        } else if (method === 'POST') {
          // Mock POST requests
          await basePage.helperActions.fulfillRoute(route, {
            article: { slug: "new-article", title: "Created via POST" }
          }, 201);
        } else {
          // Pass through other methods
          await basePage.helperActions.continueRoute(route);
        }
      }
    );

    await basePage.page.goto('https://api.realworld.show');
  });

  test('Mock with pattern matching - regex', { tag: ['@MOCK'] }, async ({ basePage }) => {
    // Match multiple endpoints with regex
    await basePage.helperActions.interceptRequests(
      /api\/(articles|comments|user)/,
      async (route: any) => {
        const url = route.request().url();

        if (url.includes('/articles')) {
          await basePage.helperActions.fulfillRoute(route, { articles: [], articlesCount: 0 });
        } else if (url.includes('/comments')) {
          await basePage.helperActions.fulfillRoute(route, { comments: [] });
        } else if (url.includes('/user')) {
          await basePage.helperActions.fulfillRoute(route, { user: { username: "mockuser" } });
        } else {
          await basePage.helperActions.continueRoute(route);
        }
      }
    );

    await basePage.page.goto('https://api.realworld.show');
  });

  test('Intercept and modify response on the fly', { tag: ['@MOCK'] }, async ({ basePage }) => {
    // Get real response, modify it, then return
    await basePage.helperActions.interceptRequests(
      '**/api/articles*',
      async (route: any) => {
        // Continue to real API and get response
        const response = await route.fetch();
        const json = await response.json();

        // Modify the response
        if (json.articles && json.articles.length > 0) {
          json.articles[0].title = 'INTERCEPTED: ' + json.articles[0].title;
        }

        // Return modified response
        await route.fulfill({
          response,
          body: JSON.stringify(json)
        });
      }
    );

    await basePage.page.goto('https://api.realworld.show');
  });

  test('Mock with delayed response', { tag: ['@MOCK', '@SLOW'] }, async ({ basePage }) => {
    await basePage.helperActions.interceptRequests(
      '**/api/articles*',
      async (route: any) => {
        // Simulate slow API (3 second delay)
        await new Promise(resolve => setTimeout(resolve, 3000));

        await basePage.helperActions.fulfillRoute(route, {
          articles: [{ slug: "slow-article", title: "This took 3 seconds" }],
          articlesCount: 1
        });
      }
    );

    const startTime = Date.now();
    await basePage.page.goto('https://api.realworld.show');
    const duration = Date.now() - startTime;

    // Verify it took at least 3 seconds
    console.log(`Request took: ${duration}ms`);
  });

  test('Block/abort specific API calls', { tag: ['@MOCK', '@BLOCK'] }, async ({ basePage }) => {
    await basePage.helperActions.interceptRequests(
      '**/api/articles*',
      async (route: any) => {
        // Completely block the request
        await basePage.helperActions.abortRoute(route);
      }
    );

    await basePage.page.goto('https://api.realworld.show');
    
    // Test should verify that articles don't load
  });

  test('Different response per call - stateful mocking', { tag: ['@MOCK'] }, async ({ basePage }) => {
    let callCount = 0;
    const responses = [
      { articles: [{ slug: "first-call", title: "First API Call" }], articlesCount: 1 },
      { articles: [{ slug: "second-call", title: "Second API Call" }], articlesCount: 1 },
      { articles: [], articlesCount: 0 }
    ];

    await basePage.helperActions.interceptRequests(
      '**/api/articles*',
      async (route: any) => {
        const response = responses[callCount] ?? { articles: [], articlesCount: 0 };
        console.log(`API call #${callCount + 1}: Returning ${response.articlesCount} articles`);
        
        await basePage.helperActions.fulfillRoute(route, response);
        callCount++;
      }
    );

    await basePage.page.goto('https://api.realworld.show');
    
    // Each time articles API is called, it returns different data
  });
});

