import { createAdminClient } from "@/lib/supabase/admin"
import { getSiteUrl } from "@/lib/seo/site-url"
import { publicPages } from "@/lib/seo/registry"

export interface SEOPageData {
  id: string
  pageKey: string
  title: string | null
  description: string | null
  keywords: string | null
  canonicalUrl: string | null
  ogTitle: string | null
  ogDescription: string | null
  ogImageUrl: string | null
  robotsRule: string
  indexable: boolean
  updatedAt: Date
}

export interface SEOSchema {
  id: string
  pageKey: string
  schemaType: string
  schemaJson: Record<string, any>
}

export interface SEOHealth {
  pageKey: string
  score: number
  issues: Array<{ type: string; message: string; severity: string }>
  lastScanAt: Date
}

export interface SEOKeywords {
  pageKey: string
  primaryKeyword: string | null
  secondaryKeywords: string[]
  targetDensity: number
  actualDensity: number
}

export class SEOService {
  /**
   * Returns a Supabase admin client, or null when env vars are missing
   * (e.g. during Vercel build without DB access).
   */
  private getSupabase() {
    try {
      return createAdminClient()
    } catch {
      return null
    }
  }



  // Get SEO metadata for a page
  async getPageSEO(pageKey: string): Promise<SEOPageData | null> {
    const supabase = this.getSupabase()
    if (!supabase) return null
    const { data, error } = await supabase
      .from("SeoPages")
      .select(
        "id, pageKey, title, description, keywords, canonicalUrl, ogTitle, ogDescription, ogImageUrl, robotsRule, indexable, updatedAt",
      )
      .eq("pageKey", pageKey)
      .maybeSingle()

    if (error) {
      console.error("[SEO] Error fetching page SEO:", error)
      return null
    }
    return data
  }

  // Update SEO metadata for a page
  async updatePageSEO(pageKey: string, data: Partial<SEOPageData>): Promise<SEOPageData | null> {
    const supabase = this.getSupabase()
    if (!supabase) return null

    // Try to update first
    const { data: existing } = await supabase.from("SeoPages").select("id").eq("pageKey", pageKey).maybeSingle()

    if (existing) {
      const { data: updated, error } = await supabase
        .from("SeoPages")
        .update({ ...data, updatedAt: new Date().toISOString() })
        .eq("pageKey", pageKey)
        .select()
        .single()

      if (error) {
        console.error("[SEO] Error updating page SEO:", error)
        return null
      }
      return updated
    } else {
      const { data: created, error } = await supabase
        .from("SeoPages")
        .insert({ pageKey, ...data })
        .select()
        .single()

      if (error) {
        console.error("[SEO] Error creating page SEO:", error)
        return null
      }
      return created
    }
  }

  // Get all SEO pages
  async getAllPages(): Promise<SEOPageData[]> {
    const supabase = this.getSupabase()
    if (!supabase) return []
    const { data, error } = await supabase
      .from("SeoPages")
      .select(
        "id, pageKey, title, description, keywords, canonicalUrl, ogTitle, ogDescription, ogImageUrl, robotsRule, indexable, updatedAt",
      )
      .order("pageKey", { ascending: true })

    if (error) {
      console.error("[SEO] Error fetching all pages:", error)
      return []
    }
    return data || []
  }

  // Get schema for a page
  async getPageSchema(pageKey: string): Promise<SEOSchema[]> {
    const supabase = this.getSupabase()
    if (!supabase) return []
    const { data, error } = await supabase
      .from("SeoSchema")
      .select("id, pageKey, schemaType, schemaJson")
      .eq("pageKey", pageKey)

    if (error) {
      console.error("[SEO] Error fetching page schema:", error)
      return []
    }
    return data || []
  }

  // Update schema for a page
  async updatePageSchema(
    pageKey: string,
    schemaType: string,
    schemaJson: Record<string, any>,
  ): Promise<SEOSchema | null> {
    const supabase = this.getSupabase()
    if (!supabase) return null

    const { data: existing } = await supabase
      .from("SeoSchema")
      .select("id")
      .eq("pageKey", pageKey)
      .eq("schemaType", schemaType)
      .maybeSingle()

    if (existing) {
      const { data: updated, error } = await supabase
        .from("SeoSchema")
        .update({ schemaJson, updatedAt: new Date().toISOString() })
        .eq("pageKey", pageKey)
        .eq("schemaType", schemaType)
        .select()
        .single()

      if (error) {
        console.error("[SEO] Error updating page schema:", error)
        return null
      }
      return updated
    } else {
      const { data: created, error } = await supabase
        .from("SeoSchema")
        .insert({ pageKey, schemaType, schemaJson })
        .select()
        .single()

      if (error) {
        console.error("[SEO] Error creating page schema:", error)
        return null
      }
      return created
    }
  }

  // Delete schema
  async deletePageSchema(id: string): Promise<void> {
    const supabase = this.getSupabase()
    if (!supabase) return
    const { error } = await supabase.from("SeoSchema").delete().eq("id", id)

    if (error) {
      console.error("[SEO] Error deleting page schema:", error)
    }
  }

  // Get SEO health score
  async getPageHealth(pageKey: string): Promise<SEOHealth | null> {
    const supabase = this.getSupabase()
    if (!supabase) return null
    const { data, error } = await supabase
      .from("SeoHealth")
      .select("pageKey, score, issuesJson, lastScanAt")
      .eq("pageKey", pageKey)
      .maybeSingle()

    if (error) {
      console.error("[SEO] Error fetching page health:", error)
      return null
    }

    return data
      ? {
          pageKey: data.pageKey,
          score: data.score,
          issues: data.issuesJson as any,
          lastScanAt: new Date(data.lastScanAt),
        }
      : null
  }

  // Calculate and update SEO health score
  async calculateHealthScore(pageKey: string, _pageContent?: string): Promise<SEOHealth | null> {
    const seoData = await this.getPageSEO(pageKey)
    const keywords = await this.getPageKeywords(pageKey)

    const issues: Array<{ type: string; message: string; severity: string }> = []
    let score = 100

    // Check title
    if (!seoData?.title) {
      issues.push({ type: "title", message: "Missing title tag", severity: "critical" })
      score -= 15
    } else if (seoData.title.length < 30 || seoData.title.length > 60) {
      issues.push({ type: "title", message: "Title length should be 30-60 characters", severity: "warning" })
      score -= 5
    }

    // Check description
    if (!seoData?.description) {
      issues.push({ type: "description", message: "Missing meta description", severity: "critical" })
      score -= 15
    } else if (seoData.description.length < 120 || seoData.description.length > 160) {
      issues.push({
        type: "description",
        message: "Description length should be 120-160 characters",
        severity: "warning",
      })
      score -= 5
    }

    // Check keywords
    if (!keywords?.primaryKeyword) {
      issues.push({ type: "keywords", message: "No primary keyword defined", severity: "warning" })
      score -= 10
    }

    // Check OG tags
    if (!seoData?.ogTitle) {
      issues.push({ type: "og", message: "Missing Open Graph title", severity: "warning" })
      score -= 5
    }
    if (!seoData?.ogDescription) {
      issues.push({ type: "og", message: "Missing Open Graph description", severity: "warning" })
      score -= 5
    }
    if (!seoData?.ogImageUrl) {
      issues.push({ type: "og", message: "Missing Open Graph image", severity: "warning" })
      score -= 5
    }

    // Check canonical URL
    if (!seoData?.canonicalUrl) {
      issues.push({ type: "canonical", message: "Missing canonical URL", severity: "warning" })
      score -= 5
    }

    // Update health record
    const supabase = this.getSupabase()
    if (!supabase) {
      return {
        pageKey,
        score: Math.max(0, score),
        issues,
        lastScanAt: new Date(),
      }
    }
    const healthData = {
      score: Math.max(0, score),
      issuesJson: issues,
      lastScanAt: new Date().toISOString(),
    }

    const { data: existing } = await supabase.from("SeoHealth").select("id").eq("pageKey", pageKey).maybeSingle()

    let result
    if (existing) {
      const { data, error } = await supabase
        .from("SeoHealth")
        .update(healthData)
        .eq("pageKey", pageKey)
        .select()
        .single()

      if (error) {
        console.error("[SEO] Error updating health score:", error)
        return null
      }
      result = data
    } else {
      const { data, error } = await supabase
        .from("SeoHealth")
        .insert({ pageKey, ...healthData })
        .select()
        .single()

      if (error) {
        console.error("[SEO] Error creating health score:", error)
        return null
      }
      result = data
    }

    return {
      pageKey: result.pageKey,
      score: result.score,
      issues: result.issuesJson as any,
      lastScanAt: new Date(result.lastScanAt),
    }
  }

  // Get keywords for a page
  async getPageKeywords(pageKey: string): Promise<SEOKeywords | null> {
    const supabase = this.getSupabase()
    if (!supabase) return null
    const { data, error } = await supabase
      .from("SeoKeywords")
      .select("pageKey, primaryKeyword, secondaryKeywords, targetDensity, actualDensity")
      .eq("pageKey", pageKey)
      .maybeSingle()

    if (error) {
      console.error("[SEO] Error fetching page keywords:", error)
      return null
    }

    return data
      ? {
          pageKey: data.pageKey,
          primaryKeyword: data.primaryKeyword,
          secondaryKeywords: (data.secondaryKeywords as string[]) || [],
          targetDensity: Number(data.targetDensity),
          actualDensity: Number(data.actualDensity),
        }
      : null
  }

  // Update keywords for a page
  async updatePageKeywords(pageKey: string, data: Partial<SEOKeywords>): Promise<SEOKeywords | null> {
    const supabase = this.getSupabase()
    if (!supabase) return null

    const { data: existing } = await supabase.from("SeoKeywords").select("id").eq("pageKey", pageKey).maybeSingle()

    let result
    if (existing) {
      const { data: updated, error } = await supabase
        .from("SeoKeywords")
        .update({ ...data, updatedAt: new Date().toISOString() })
        .eq("pageKey", pageKey)
        .select()
        .single()

      if (error) {
        console.error("[SEO] Error updating page keywords:", error)
        return null
      }
      result = updated
    } else {
      const { data: created, error } = await supabase
        .from("SeoKeywords")
        .insert({ pageKey, ...data })
        .select()
        .single()

      if (error) {
        console.error("[SEO] Error creating page keywords:", error)
        return null
      }
      result = created
    }

    return {
      pageKey: result.pageKey,
      primaryKeyword: result.primaryKeyword,
      secondaryKeywords: (result.secondaryKeywords as string[]) || [],
      targetDensity: Number(result.targetDensity),
      actualDensity: Number(result.actualDensity),
    }
  }

  // Get SEO dashboard summary
  async getDashboardSummary() {
    const pages = await this.getAllPages()

    const supabase = this.getSupabase()
    let records: Array<{ pageKey: string; score: number; issuesJson: any; lastScanAt: string }> = []

    if (supabase) {
      const { data: healthRecords, error } = await supabase
        .from("SeoHealth")
        .select("pageKey, score, issuesJson, lastScanAt")

      if (error) {
        console.error("[SEO] Error fetching health records:", error)
      }
      records = healthRecords || []
    }

    const totalPages = pages.length
    const indexablePages = pages.filter((p) => p.indexable).length
    const avgScore = records.length > 0 ? records.reduce((sum, h) => sum + h.score, 0) / records.length : 0

    const criticalIssues = records.reduce((count, h) => {
      const issues = (h.issuesJson as any[]) || []
      return count + issues.filter((i) => i.severity === "critical").length
    }, 0)

    return {
      totalPages,
      indexablePages,
      avgScore: Math.round(avgScore),
      criticalIssues,
      pages: records.map((h) => ({
        pageKey: h.pageKey,
        score: h.score,
        lastScanAt: h.lastScanAt,
      })),
    }
  }

  /** Build the static fallback sitemap from the page registry */
  private getFallbackSitemap() {
    const baseUrl = getSiteUrl()
    const today = new Date().toISOString().split("T")[0]

    return publicPages.map((p) => ({
      loc: `${baseUrl}${p.path === "/" ? "" : p.path}`,
      lastmod: today,
      changefreq: p.changefreq,
      priority: p.priority,
    }))
  }

  // Generate sitemap data
  async generateSitemap() {
    const baseUrl = getSiteUrl()

    try {
      const supabase = this.getSupabase()
      if (!supabase) {
        console.warn("[SEO] Supabase client unavailable — returning static fallback sitemap")
        return this.getFallbackSitemap()
      }

      const { data: pages, error } = await supabase
        .from("SeoPages")
        .select("pageKey, canonicalUrl, updatedAt")
        .eq("indexable", true)

      if (error) {
        console.warn("[SEO] DB query failed during sitemap generation — using fallback:", error.message)
        return this.getFallbackSitemap()
      }

      if (!pages || pages.length === 0) {
        return this.getFallbackSitemap()
      }

      return pages.map((page) => ({
        loc: page.canonicalUrl || `${baseUrl}/${page.pageKey === "home" ? "" : page.pageKey}`,
        lastmod: new Date(page.updatedAt).toISOString().split("T")[0],
        changefreq: "weekly",
        priority: page.pageKey === "home" ? "1.0" : "0.8",
      }))
    } catch (err) {
      console.warn("[SEO] Unexpected error generating sitemap — using fallback:", err)
      return this.getFallbackSitemap()
    }
  }

  // Generate robots.txt rules
  generateRobotsTxt() {
    const baseUrl = getSiteUrl()

    const rules = [
      "User-agent: *",
      "Allow: /",
      "",
      "# Disallow admin and authenticated areas",
      "Disallow: /admin/",
      "Disallow: /buyer/",
      "Disallow: /dealer/",
      "Disallow: /affiliate/portal/",
      "Disallow: /api/",
      "",
      `Sitemap: ${baseUrl}/sitemap.xml`,
    ]

    return rules.join("\n")
  }
}

export const seoService = new SEOService()

export { SEOService as default }
export const SEOServiceInstance = seoService
