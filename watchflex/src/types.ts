export type Category = 'TIMEPIECE' | 'ACCESSORIES';
export interface Product {
  id: number; name: string; price: number; tag: Category;
  image: string; subtitle: string; description?: string;
}
/** The cart stores only id + qty; name/price are always read from the catalogue. */
export interface CartItem { id: number; qty: number }
export interface CartLine { product: Product; qty: number }
