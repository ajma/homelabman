import { describe, expect, it } from "vitest";
import {
  extractComposeTargetPorts,
  extractTargetPortFromEntry,
  parsePort,
  extractComposeProjectName,
  extractFirstComposeTargetPort,
} from "../ProjectEditor";

describe("project editor compose target port helpers", () => {
  it("parses valid numeric ports and rejects invalid values", () => {
    expect(parsePort(80)).toBe(80);
    expect(parsePort("443")).toBe(443);

    expect(parsePort(0)).toBeNull();
    expect(parsePort("abc")).toBeNull();
    expect(parsePort(70000)).toBeNull();
  });

  it("extracts target ports from compose short and long port syntax", () => {
    expect(extractTargetPortFromEntry("8080:80")).toBe(80);
    expect(extractTargetPortFromEntry("127.0.0.1:8443:443/tcp")).toBe(443);
    expect(extractTargetPortFromEntry("80")).toBe(80);
    expect(extractTargetPortFromEntry({ target: 3000, published: 3001 })).toBe(
      3000,
    );
    expect(extractTargetPortFromEntry({ port: "9000" })).toBe(9000);
  });

  it("extracts unique sorted target ports from compose yaml", () => {
    const compose = `
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
      - "8443:443/tcp"
  api:
    image: node:20
    ports:
      - target: 3000
        published: 3001
        protocol: tcp
      - "80"
`;

    expect(extractComposeTargetPorts(compose)).toEqual([80, 443, 3000]);
  });

  it("returns empty array for invalid yaml", () => {
    expect(extractComposeTargetPorts("services: [")).toEqual([]);
  });
});

describe("extractComposeProjectName", () => {
  it("returns the first service key", () => {
    const compose = `services:\n  my-app:\n    image: nginx`;
    expect(extractComposeProjectName(compose)).toBe("my-app");
  });

  it("returns the first service key even when multiple services are defined", () => {
    const compose = `services:\n  web:\n    image: nginx\n  db:\n    image: postgres`;
    expect(extractComposeProjectName(compose)).toBe("web");
  });

  it("returns null when services block is missing", () => {
    expect(extractComposeProjectName('version: "3"')).toBeNull();
  });

  it("returns null on invalid yaml", () => {
    expect(extractComposeProjectName("services: [")).toBeNull();
  });

  it("returns null for empty content", () => {
    expect(extractComposeProjectName("")).toBeNull();
  });
});

describe("extractFirstComposeTargetPort", () => {
  it("returns the first target port from the first service that has ports", () => {
    const compose = `
services:
  web:
    image: nginx
    ports:
      - "8080:80"
      - "8443:443"
  api:
    image: node
    ports:
      - "3001:3000"
`;
    expect(extractFirstComposeTargetPort(compose)).toBe(80);
  });

  it("skips services with no ports and returns first from the first service that has them", () => {
    const compose = `
services:
  db:
    image: postgres
  api:
    image: node
    ports:
      - target: 3000
        published: 3001
`;
    expect(extractFirstComposeTargetPort(compose)).toBe(3000);
  });

  it("returns null when no services have ports", () => {
    const compose = `
services:
  db:
    image: postgres
`;
    expect(extractFirstComposeTargetPort(compose)).toBeNull();
  });

  it("returns null for empty content", () => {
    expect(extractFirstComposeTargetPort("")).toBeNull();
  });

  it("returns null on invalid yaml", () => {
    expect(extractFirstComposeTargetPort("services: [")).toBeNull();
  });
});
