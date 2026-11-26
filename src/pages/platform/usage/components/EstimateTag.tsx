/** "est." marker for compute figures, which are estimated from metered request
 *  and background-job time rather than billed per tenant. */
export function EstimateTag() {
  return (
    <abbr
      title="Estimated from metered request and background-job time"
      className="ml-1 rounded border border-stone-300 px-1 align-[1px] text-[10px] font-medium normal-case tracking-normal text-stone-500 no-underline"
    >
      est.
    </abbr>
  );
}
