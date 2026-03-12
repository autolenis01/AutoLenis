import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the createAdminClient to prevent DB calls in tests
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    throw new Error("DB not available in test")
  },
}))

import { SEOService } from "@/lib/services/seo.service"
import { getSiteUrl } from "@/lib/seo/site-url"
import { publicPages } from "@/lib/seo/registry"

describe("SEO Deploy Safety", () => {
  let service: SEOService

  beforeEach(() => {
    service = new SEOService()
  })

  describe("getSiteUrl", () => {
    it("returns a non-empty URL", () => {
      const url = getSiteUrl()
      expect(url).toBeTruthy()
      expect(url.startsWith("http")).toBe(true)
    })

    it("has no trailing slash", () => {
      const url = getSiteUrl()
      expect(url.endsWith("/")).toBe(false)
    })
  })

  describe("publicPages registry", () => {
    it("has at least the homepage", () => {
      const home = publicPages.find((p) => p.path === "/")
      expect(home).toBeDefined()
      expect(home!.priority).toBe("1.0")
    })

    it("includes core marketing pages", () => {
      const requiredPaths = ["/", "/about", "/pricing", "/contact", "/how-it-works", "/faq"]
      for (const path of requiredPaths) {
        expect(publicPages.find((p) => p.path === path)).toBeDefined()
      }
    })
  })

  describe("generateSitemap (no DB)", () => {
    it("returns a non-empty array even without DB", async () => {
      const urls = await service.generateSitemap()
      expect(Array.isArray(urls)).toBe(true)
      expect(urls.length).toBeGreaterThan(0)
    })

    it("every entry has loc, lastmod, changefreq, priority", async () => {
      const urls = await service.generateSitemap()
      for (const url of urls) {
        expect(url.loc).toBeTruthy()
        expect(url.lastmod).toBeTruthy()
        expect(url.changefreq).toBeTruthy()
        expect(url.priority).toBeTruthy()
      }
    })

    it("includes the homepage URL", async () => {
      const urls = await service.generateSitemap()
      const baseUrl = getSiteUrl()
      expect(urls.some((u) => u.loc === baseUrl)).toBe(true)
    })
  })

  describe("generateRobotsTxt (no DB)", () => {
    it("returns valid robots.txt content", () => {
      const txt = service.generateRobotsTxt()
      expect(txt).toContain("User-agent: *")
      expect(txt).toContain("Allow: /")
      expect(txt).toContain("Disallow: /admin/")
      expect(txt).toContain("Sitemap:")
      expect(txt).toContain("/sitemap.xml")
    })
  })
})
