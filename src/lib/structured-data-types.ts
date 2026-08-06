// 严格的结构化数据接口定义
export interface OrganizationData {
  name?: string;
  description?: string;
  url?: string;
  logo?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface WebSiteData {
  name?: string;
  description?: string;
  url?: string;
}

export interface ArticleData {
  title: string;
  description: string;
  author?: string;
  publishedTime: string;
  modifiedTime?: string;
  url: string;
  image?: string;
  section?: string;
}

export interface BreadcrumbData {
  items: Array<{
    name: string;
    url: string;
    position: number;
  }>;
}
