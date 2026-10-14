// Customer-portal "Created Orders" — a countertop order form a customer files
// with their fabricator: project details plus one block per area of the house
// (kitchen, island, baths, …). Mirrors the paper "Countertop Order Form".

/** The kinds of area an order can describe. `bath` and `custom` may repeat. */
export type AreaKind =
  | 'kitchen'
  | 'island'
  | 'pantry'
  | 'hutch'
  | 'utility'
  | 'master_bath'
  | 'powder_1'
  | 'powder_2'
  | 'bath'
  | 'custom';

/** One tick box on the form's Faucet Spread row: `L` / `R` is the side of the
 *  centre line, the number is inches from it, `C` is the centre. */
export type FaucetSpreadPosition =
  | 'L12'
  | 'L8'
  | 'L4'
  | 'L2'
  | 'C'
  | 'R2'
  | 'R4'
  | 'R8'
  | 'R12';

/** One area of an order, exactly as it is sent to and returned by the API. */
export interface CreatedOrderArea {
  kind: AreaKind;
  /** Display name — the kind's own label, or what the customer typed for a
   *  Bath / Custom area. */
  name: string;
  color: string;
  finish: string;
  edge: string;
  /** Inches; '' when the area has no backsplash. */
  backsplashHeight: string;
  sinkModel: string;
  cooktopModel: string;
  waterfallQty: number;
  popUpOutlet: number;
  halfWall: boolean;
  location: string;
  faucetSpread: FaucetSpreadPosition[];
  notes: string;
}

/** The request body for creating an order. */
export interface CreatedOrderInput {
  builder: string;
  community: string;
  plan: string;
  phone: string;
  email: string;
  installAddress: string;
  city: string;
  zip: string;
  /** ISO `yyyy-mm-dd`. */
  measureDate: string;
  /** ISO `yyyy-mm-dd`. */
  installDate: string;
  specialInstructions: string;
  areas: CreatedOrderArea[];
}

/** An order as the API returns it. */
export interface CreatedOrder extends CreatedOrderInput {
  id: string;
  /** Human-readable reference assigned by the server, when it has one. */
  orderNumber?: string;
  status: string;
  createdAt: string;
}

export interface CreatedOrderPage {
  orders: CreatedOrder[];
  /** Opaque keyset cursor — '' when there are no more pages. */
  nextCursor: string;
}
