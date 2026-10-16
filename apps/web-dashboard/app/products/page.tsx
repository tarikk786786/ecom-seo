import type { Metadata } from "next";
import { ProductsWorkspace } from "@/components/products/workspace";
import { listProducts } from "@/lib/products/repository";

export const metadata: Metadata = { title: "Products" };
export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const initial = await listProducts({ page: 1, pageSize: 25 });
  return <ProductsWorkspace initial={initial} />;
}
