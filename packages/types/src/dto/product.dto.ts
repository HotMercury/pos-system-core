export interface ProductDTO {
  id: string;
  name: string;
  englishName?: string;
  description?: string;
  price: number;
  category: string;
  imageUrl?: string;
  isAvailable: boolean;
  variants: ProductVariantDTO[];
}

export interface ProductVariantDTO {
  id: string;
  size: "M" | "L";
  temperature: "H" | "I";
  flavor?: string;
  price: number;
  isAvailable: boolean;
}
