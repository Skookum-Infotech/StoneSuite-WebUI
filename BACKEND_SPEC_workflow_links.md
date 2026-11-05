# Backend spec: workflow links for the end-to-end progress card

**For:** `StoneSuite` backend repo. **Requested by:** StoneSuite-WebUI, branch `claude/progress-bar-redesign-307506` (PR 373).

## Why

The detail pages are getting a "Workflow" card that shows the whole flow of a record, with the sub-statuses of each stage on hover:

- **Sales:** Quote → Sales Order → Fabrication → Invoice → Payment
- **Purchases:** Requisition → Purchase Order → Receiving → Vendor Bill → Payment

Today a child record knows its parent, but a parent cannot find its children, so the card cannot be filled in from the frontend alone. This spec adds one read-only `workflow` block to each detail response so the card needs no extra calls.

## What the frontend has today

| Link | Where | Status |
|---|---|---|
| Invoice → Sales Order | `Invoice.salesOrder {id, number}` | exists |
| Vendor Bill → Purchase Order | `VendorBill.purchaseOrder {id, number}` | exists |
| Fabrication Job → Sales Order | `FabricationJob.salesOrderId` | exists |
| Payment → Invoice | `Payment.invoiceId` | exists |
| Vendor Payment → Vendor Bill | `VendorPayment.vendorBillId` | exists |
| Requisition → Purchase Order | `Requisition.convertedPurchaseOrderId` | exists |
| Purchase Order → Item Receipts | `GET /purchase-orders/{id}/receipts` | exists |
| Quote → Estimate | `Quote.estimate` | exists (not part of this card) |
| Sales Order → Quote | none | **missing** |
| Sales Order → Fabrication Jobs | none | **missing** |
| Sales Order → Invoices | none | **missing** |
| Invoice → Payments | none | **missing** |
| Purchase Order → Requisition | none | **missing** |
| Purchase Order → Vendor Bills | none | **missing** |
| Vendor Bill → Vendor Payments | none | **missing** |

List searches filter by number or text (for example `purchase_order_number`), not by linked ID, so the frontend cannot safely look children up through them.

## Proposed change

Add a `workflow` object to the **detail response** (GET one record) of these modules. It is read-only and computed on read; no new tables or writes are needed if the foreign keys above already exist in the database.

### Shared shape

```json
{
  "workflow": {
    "stages": [
      {
        "key": "invoice",
        "records": [
          { "id": "uuid", "number": "INV-000031", "statusCode": "SENT", "status": "Sent" }
        ]
      }
    ]
  }
}
```

- `key` is one of the stage keys listed per module below.
- `records` is an array, because one order can have several invoices, jobs, receipts or bills. An empty array means "nothing created yet" and must not be omitted.
- Every record carries `id`, `number`, `statusCode` and `status` (the human label), the same fields the list rows already return.
- Cancelled or void records are included, so the card can show them in red.
- Records outside the caller's scope or RBAC permission are left out of `records`, with no error. Return a boolean `hidden: true` on the stage if any were dropped, so the UI can say "some records not shown" without revealing what they are. This follows the existing IDOR rule.

### Per module

| Detail endpoint | Stage keys to return |
|---|---|
| Sales Order | `quote`, `salesOrder` (itself), `fabrication`, `invoice`, `payment` |
| Quote | same as Sales Order |
| Invoice | same as Sales Order |
| Fabrication Job | same as Sales Order |
| Payment | same as Sales Order |
| Purchase Order | `requisition`, `purchaseOrder` (itself), `receiving`, `vendorBill`, `vendorPayment` |
| Requisition | same as Purchase Order |
| Item Receipt | same as Purchase Order |
| Vendor Bill | same as Purchase Order |
| Vendor Payment | same as Purchase Order |

Any record in a flow returns the **same** stages for the whole flow, so the card looks identical wherever you open it. The stages are resolved by walking up to the root document and down again.

Payments are the payments applied to the flow's invoices. Vendor payments are the payments applied to the flow's vendor bills.

### What each hop needs in the database

1. Sales Order → Quote: the sales order must store its source quote (or the quote stores the order it converted into). If neither exists, add `sales_order.source_quote_id`.
2. Purchase Order → Requisition: the inverse of `Requisition.convertedPurchaseOrderId`; no new column.
3. Everything else is the inverse of a foreign key the frontend already receives.

### Open questions for backend

1. Does a Sales Order currently remember the Quote it came from? If not, which direction should the link be stored?
2. Can one Sales Order spawn more than one Fabrication Job and more than one Invoice? The frontend assumes yes.
3. Should the block also include credit memos, refunds and vendor credits as a `related` list? The UI would show them as a small line under the flow. Optional for v1.
4. Is a per-record `statusCode` enough, or should the response also return the record's ordered status path so the hover panel does not depend on the frontend's own status lists?

## Frontend contract once this ships

- The card reads `workflow` from the detail response that the page already loads, so there is no extra request.
- A missing `workflow` block (older backend) shows each stage as "Not linked" instead of failing.
- Hovering a stage shows that record's own sub-statuses, using the existing per-module status lists and the dates the progress card already reads from each audit trail.
- Clicking a stage opens that linked record. A stage with several records opens a short list.

## Acceptance checks

- A Sales Order with one quote, two invoices, one fabrication job and a payment returns all of them under the right keys, from every one of those records' detail endpoints.
- A Purchase Order with no bills returns `vendorBill` with `records: []`.
- A caller without invoice permission gets `invoice.records: []` and `hidden: true`, and the rest of the response is unchanged.
- A cancelled invoice still appears, with its `statusCode`.
- The extra work does not add more than a few queries per detail request.

## Addendum: Installation and Refund stages (sales flow)

The sales card now has seven stages: Quote, Sales order, Fabrication, Installation, Invoice, Payment, Refund.

- **Installation** needs no new data. It reads the same `fabrication` records: a job is on Fabrication up to `RSHP` (Ready for Shipping) and on Installation from `TRAN` (In Transit) to `COMP`.
- **Refund** is a new stage key, `refund`. Add `{ "key": "refund", "records": [...] }` to the `workflow` block of Quote, Sales order, Fabrication job, Invoice and Payment detail responses, listing refunds against the order's payments (same record shape; empty array when none). A Refund detail response should also carry the `workflow` block, with its own record in the `refund` stage.
- Whenever a conversion creates a record (Sales order to Invoice, Sales order to Fabrication job, Payment to Refund), the parent's next detail response must already list it, so the card updates live.
