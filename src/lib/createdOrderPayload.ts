import { areaKindConfig, FAUCET_SPREAD_OPTIONS } from '@/lib/createdOrderAreas';
import type { AreaFieldKey } from '@/lib/createdOrderAreas';
import type { AreaDraft, CreatedOrderFormState } from '@/lib/createdOrderForm';
import type { CreatedOrder, CreatedOrderArea, CreatedOrderInput } from '@/types/createdOrder';

// Maps between the Created Order form's state and the API's order shape — the
// request body going out, and a saved order coming back in to be changed.

function toAreaPayload(area: AreaDraft): CreatedOrderArea {
  const config = areaKindConfig(area.kind);
  const has = (field: AreaFieldKey): boolean => config.fields.includes(field);
  const text = (field: AreaFieldKey, value: string): string => (has(field) ? value.trim() : '');
  const spreadOrder = FAUCET_SPREAD_OPTIONS[config.spreadScale].map((option) => option.value);

  return {
    kind: area.kind,
    name: area.name.trim(),
    color: text('color', area.color),
    finish: text('finish', area.finish),
    edge: text('edge', area.edge),
    backsplashHeight: text('backsplashHeight', area.backsplashHeight),
    sinkModel: text('sinkModel', area.sinkModel),
    cooktopModel: text('cooktopModel', area.cooktopModel),
    waterfallQty: has('waterfallQty') ? area.waterfallQty : 0,
    popUpOutlet: has('popUpOutlet') ? area.popUpOutlet : 0,
    halfWall: has('halfWall') ? area.halfWall : false,
    location: text('location', area.location),
    faucetSpread: spreadOrder.filter((position) => area.faucetSpread.includes(position)),
    notes: area.notes.trim(),
  };
}

/** The request body: trimmed text, no client keys, and any value an area's kind
 *  does not show (left over from a copy or an edit) reset to empty. */
export function toCreatePayload(form: CreatedOrderFormState): CreatedOrderInput {
  return {
    builder: form.builder.trim(),
    community: form.community.trim(),
    plan: form.plan.trim(),
    phone: form.phone.trim(),
    email: form.email.trim(),
    installAddress: form.installAddress.trim(),
    city: form.city.trim(),
    zip: form.zip.trim(),
    measureDate: form.measureDate,
    installDate: form.installDate,
    specialInstructions: form.specialInstructions.trim(),
    areas: form.areas.map(toAreaPayload),
  };
}

/** An existing order as form state, to change it. The keys are client-only and
 *  never sent; they cannot collide with the ones new areas are given. */
export function toFormState(order: CreatedOrder): CreatedOrderFormState {
  return {
    builder: order.builder,
    community: order.community,
    plan: order.plan,
    phone: order.phone,
    email: order.email,
    installAddress: order.installAddress,
    city: order.city,
    zip: order.zip,
    measureDate: order.measureDate,
    installDate: order.installDate,
    specialInstructions: order.specialInstructions,
    areas: order.areas.map((area, index) => ({
      ...area,
      faucetSpread: [...area.faucetSpread],
      key: `saved-${index}`,
    })),
  };
}
