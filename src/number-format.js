/** Display precision only: never modifies graph/trace values. */
export function formatNumber(value, format='g', digits=6) {
  if(typeof value==='string'){
    if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value))return value;
    // Preserve exact integer strings outside the JavaScript integer range.
    if(/^[+-]?\d+$/.test(value)&&!Number.isSafeInteger(Number(value)))return value;
  }
  const number=Number(value);
  if(!Number.isFinite(number))return String(value);
  digits=Math.max(format==='g'?1:0,Math.min(16,Math.trunc(digits)));
  const sign=Object.is(number,-0)?'-':'';
  if(format==='f')return sign+number.toFixed(digits);
  if(format==='e')return sign+number.toExponential(digits);
  const rounded=Number(number.toPrecision(digits));
  const exponent=rounded===0?0:Math.floor(Math.log10(Math.abs(rounded)));
  const text=exponent<-4||exponent>=digits?number.toExponential(digits-1):number.toFixed(Math.max(0,digits-exponent-1));
  return sign+text.replace(/(\.\d*?[1-9])0+(?=e|$)|\.0+(?=e|$)/g,'$1');
}
