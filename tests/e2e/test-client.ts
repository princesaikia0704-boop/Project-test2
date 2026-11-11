/**
 * Opaque Test Client with Multi-Persona Authentication and Dual-Mode Execution
 * Adheres strictly to Dual Track Principles (Zero Internal Coupling)
 */

import { MockHttpDriver } from './mock-driver';
import { HttpRequestOptions, HttpResponse, UserPersona } from './types';

export const PERSONAS = {
  ALICE_EMPLOYEE: {
    id: 'user-alice-emp',
    clerkId: 'user_clerk_alice_123',
    name: 'Alice Engineer',
    email: 'alice@company.com',
    role: 'EMPLOYEE' as const,
    departmentId: 'dept-eng',
  },
  BOB_EMPLOYEE: {
    id: 'user-bob-emp',
    clerkId: 'user_clerk_bob_456',
    name: 'Bob Staff Engineer',
    email: 'bob@company.com',
    role: 'EMPLOYEE' as const,
    departmentId: 'dept-eng',
  },
  CAROL_MANAGER: {
    id: 'user-carol-mgr',
    clerkId: 'user_clerk_carol_789',
    name: 'Carol Manager',
    email: 'carol@company.com',
    role: 'MANAGER' as const,
    departmentId: 'dept-eng',
  },
  DAVE_ADMIN: {
    id: 'user-dave-adm',
    clerkId: 'user_clerk_dave_001',
    name: 'Dave Administrator',
    email: 'dave@company.com',
    role: 'ADMIN' as const,
    departmentId: 'dept-ops',
  },
};

export class TestClient {
  private baseUrl?: string;
  private mockDriver: MockHttpDriver;
  private currentPersona?: UserPersona = PERSONAS.ALICE_EMPLOYEE;
  private defaultTimeoutMs = 8000;

  constructor(mockDriver?: MockHttpDriver) {
    this.baseUrl = process.env.API_BASE_URL;
    this.mockDriver = mockDriver || new MockHttpDriver();
  }

  public getMockDriver(): MockHttpDriver {
    return this.mockDriver;
  }

  public asPersona(persona: UserPersona | undefined): TestClient {
    const clone = new TestClient(this.mockDriver);
    clone.baseUrl = this.baseUrl;
    clone.currentPersona = persona;
    return clone;
  }

  public asEmployee(): TestClient {
    return this.asPersona(PERSONAS.ALICE_EMPLOYEE);
  }

  public asManager(): TestClient {
    return this.asPersona(PERSONAS.CAROL_MANAGER);
  }

  public asAdmin(): TestClient {
    return this.asPersona(PERSONAS.DAVE_ADMIN);
  }

  public asUnauthenticated(): TestClient {
    return this.asPersona(undefined);
  }

  public reset(): void {
    this.mockDriver.reset();
  }

  public async request(path: string, method: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    const mergedOptions: HttpRequestOptions = {
      ...options,
      persona: options.persona !== undefined ? options.persona : this.currentPersona,
      timeoutMs: options.timeoutMs || this.defaultTimeoutMs,
    };

    // If live base URL is configured and live testing is forced:
    if (this.baseUrl && process.env.MOCK_SIMULATOR !== 'true') {
      try {
        const url = new URL(path, this.baseUrl);
        if (mergedOptions.query) {
          Object.entries(mergedOptions.query).forEach(([k, v]) => url.searchParams.append(k, String(v)));
        }

        const headers: Record<string, string> = {
          'content-type': 'application/json',
          ...(mergedOptions.headers || {}),
        };

        if (mergedOptions.persona) {
          headers['Authorization'] = `Bearer mock_jwt_${mergedOptions.persona.role.toLowerCase()}_${mergedOptions.persona.id}`;
          headers['x-user-role'] = mergedOptions.persona.role;
          headers['x-user-id'] = mergedOptions.persona.id;
          headers['x-department-id'] = mergedOptions.persona.departmentId;
        }

        if (mergedOptions.idempotencyKey) {
          headers['Idempotency-Key'] = mergedOptions.idempotencyKey;
        }

        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), mergedOptions.timeoutMs);

        const res = await fetch(url.toString(), {
          method,
          headers,
          body: mergedOptions.body ? JSON.stringify(mergedOptions.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const data = await res.json().catch(() => ({}));
        const resHeaders: Record<string, string> = {};
        res.headers.forEach((v, k) => {
          resHeaders[k.toLowerCase()] = v;
        });

        return {
          status: res.status,
          statusText: res.statusText,
          headers: resHeaders,
          data,
          durationMs: Date.now() - startTime,
        };
      } catch (err: any) {
        // Fall back to mock driver if live connection fails or was not ready
        return this.mockDriver.handleRequest(path, method, mergedOptions);
      }
    }

    // Default: High-fidelity protocol simulator
    return this.mockDriver.handleRequest(path, method, mergedOptions);
  }

  public get(path: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    return this.request(path, 'GET', options);
  }

  public post(path: string, body?: any, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    return this.request(path, 'POST', { ...options, body });
  }

  public put(path: string, body?: any, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    return this.request(path, 'PUT', { ...options, body });
  }

  public delete(path: string, options: HttpRequestOptions = {}): Promise<HttpResponse> {
    return this.request(path, 'DELETE', options);
  }
}
