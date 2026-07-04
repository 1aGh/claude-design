var LJ=Object.defineProperty;var OJ=(J,j)=>{for(var Q in j)LJ(J,Q,{get:j[Q],enumerable:!0,configurable:!0,set:($)=>j[Q]=()=>$})};var Uj={};OJ(Uj,{useTransitionProgress:()=>U0,springTiming:()=>H0,makeHtmlInCanvasPresentation:()=>Jj,linearTiming:()=>Q0,linearBlur:()=>j0,filmBurn:()=>nQ,dreamyZoom:()=>iQ,crossZoom:()=>fQ,TransitionSeries:()=>Qj});import{useMemo as nj}from"react";import{AbsoluteFill as zQ}from"remotion";import{jsx as MQ}from"react/jsx-runtime";import{useCallback as bQ,useLayoutEffect as e,useMemo as CQ,useRef as Mj,useState as rj}from"react";import{AbsoluteFill as EQ,HTML_IN_CANVAS_UNSUPPORTED_MESSAGE as kQ,HtmlInCanvas as SQ,Internals as Lj,useDelayRender as wQ}from"remotion";import{jsx as bj}from"react/jsx-runtime";import{interpolate as J0}from"remotion";import{measureSpring as $0,spring as Z0}from"remotion";import{Children as K0,useCallback as Oj,useMemo as HJ,useRef as KJ}from"react";import{Internals as d,Interactive as W0,Sequence as Y0,useCurrentFrame as X0,useVideoConfig as G0}from"remotion";var Yj=(J)=>{return Math.round(J*1e6)/1e6},bJ=new Set(["deg","rad","grad","turn"]),hj=new Set(["%","cap","ch","cm","cqb","cqh","cqi","cqmax","cqmin","cqw","dvh","dvw","em","ex","ic","in","lh","lvh","lvw","mm","pc","pt","px","q","rem","rlh","svh","svw","vb","vh","vi","vmax","vmin","vw"]),dj=/^([+-]?(?:\d+\.?\d*|\.\d+))([a-zA-Z%]+)?$/,cj=new Set(["left","center","right","top","bottom"]),p=(J)=>{if(J==="left")return[{axis:"x",value:{value:0,unit:"%"}}];if(J==="right")return[{axis:"x",value:{value:100,unit:"%"}}];if(J==="top")return[{axis:"y",value:{value:0,unit:"%"}}];if(J==="bottom")return[{axis:"y",value:{value:100,unit:"%"}}];return[{axis:"x",value:{value:50,unit:"%"}},{axis:"y",value:{value:50,unit:"%"}}]},n={value:50,unit:"%"},Sj=(J)=>{return String(Yj(J))},CJ=(J,j)=>{let Q=dj.exec(J);if(Q===null)throw TypeError(`Cannot interpolate "${j}" because "${J}" is not a supported scale, translate, or rotate value`);let $=Q[2]??null,Z=Number(Q[1]);if(!Number.isFinite(Z))throw TypeError(`Cannot interpolate "${j}" because "${J}" is not finite`);if($===null)return{kind:"scale",value:Z,unit:null};if(bJ.has($))return{kind:"rotate",value:Z,unit:$};if(hj.has($))return{kind:"translate",value:Z,unit:$};throw TypeError(`Cannot interpolate "${j}" because "${$}" is not a supported translate or rotate unit`)},uj=({component:J,value:j,allowPercentage:Q})=>{let $=dj.exec(J);if($===null)throw TypeError(`Cannot interpolate "${j}" because "${J}" is not a supported transform-origin ${Q?"length-percentage":"z length"}`);let Z=$[2]??null,H=Number($[1]);if(!Number.isFinite(H))throw TypeError(`Cannot interpolate "${j}" because "${J}" is not finite`);if(Z===null||!hj.has(Z)||!Q&&Z==="%")throw TypeError(`Cannot interpolate "${j}" because "${J}" is not a supported transform-origin ${Q?"length-percentage":"z length"}`);return{value:H,unit:Z}},qj=(J,j)=>{let Q=J.toLowerCase();if(cj.has(Q))return{type:"keyword",keyword:Q};return{type:"length-percentage",parsed:uj({component:J,value:j,allowPercentage:!0})}},EJ=(J,j,Q)=>{let $=[];for(let Z of p(J))for(let H of p(j)){if(Z.axis===H.axis)continue;$.push(Z.axis==="x"?[Z.value,H.value]:[H.value,Z.value])}if($.length===0)throw TypeError(`Cannot interpolate "${Q}" because "${J} ${j}" is not a valid transform-origin keyword pair`);return $[0]},kJ=(J,j)=>{if(J.length===1){let K=qj(J[0],j);if(K.type==="length-percentage")return[K.parsed,n];if(K.keyword==="top"||K.keyword==="bottom")return[n,p(K.keyword)[0].value];return[p(K.keyword)[0].value,n]}let Q=qj(J[0],j),$=qj(J[1],j);if(Q.type==="length-percentage"&&$.type==="length-percentage")return[Q.parsed,$.parsed];if(Q.type==="keyword"&&$.type==="keyword")return EJ(Q.keyword,$.keyword,j);let Z=Q.type==="keyword"?Q:$.type==="keyword"?$:null,H=Q.type==="length-percentage"?Q.parsed:$.type==="length-percentage"?$.parsed:null;if(Z===null||H===null)throw Error("Expected a keyword and a length-percentage value");let Y=Q.type==="keyword";if(Z.keyword==="left"||Z.keyword==="right"){if(!Y)throw TypeError(`Cannot interpolate "${j}" because horizontal transform-origin keywords must come before a length-percentage value`);return[p(Z.keyword)[0].value,H]}if(Z.keyword==="top"||Z.keyword==="bottom")return[H,p(Z.keyword)[0].value];return Y?[n,H]:[H,n]},SJ=(J,j)=>{let[Q,$]=kJ(j.slice(0,2),J),Z=j[2]===void 0?{value:0,unit:null}:uj({component:j[2],value:J,allowPercentage:!1});return{kind:"translate",values:[Q.value,$.value,Z.value],units:[Q.unit,$.unit,Z.unit],dimensions:j[2]===void 0?2:3}},wJ=(J)=>{if(typeof J==="number"){if(!Number.isFinite(J))throw Error(`outputRange must contain only finite numbers, but got [${J}]`);return{kind:"scale",values:[J,J,1],units:[null,null,null],dimensions:1}}let j=J.trim().split(/\s+/);if(j.length<1||j.length>3||j[0]==="")throw TypeError(`String outputRange values must contain 1 to 3 components, but got "${J}"`);if(j.some((Z)=>cj.has(Z.toLowerCase())))return SJ(J,j);let Q=j.map((Z)=>CJ(Z,J)),[{kind:$}]=Q;for(let Z of Q)if(Z.kind!==$)throw TypeError(`Cannot interpolate "${J}" because it mixes ${$} and ${Z.kind} values`);if($==="scale"){let Z=Q[0].value,H=Q[1]?.value??Z,Y=Q[2]?.value??1;return{kind:$,values:[Z,H,Y],units:[null,null,null],dimensions:Q.length}}return{kind:$,values:[Q[0].value,Q[1]?.value??0,Q[2]?.value??0],units:[Q[0].unit,Q[1]?.unit??null,Q[2]?.unit??null],dimensions:Q.length}},FJ=({kind:J,values:j,units:Q,dimensions:$})=>{if(J==="scale")return j.slice(0,$).map((Z)=>Sj(Z)).join(" ");return j.slice(0,$).map((Z,H)=>`${Sj(Z)}${Q[H]}`).join(" ")};function yJ(J,j,Q,$){let{extrapolateLeft:Z,extrapolateRight:H,easing:Y}=$,K=J,[W,X]=j,[G,D]=Q;if(K<W){if(Z==="identity")return K;if(Z==="clamp")K=W;else if(Z==="wrap"){let _=X-W;K=((K-W)%_+_)%_+W}}if(K>X){if(H==="identity")return K;if(H==="clamp")K=X;else if(H==="wrap"){let _=X-W;K=((K-W)%_+_)%_+W}}if(G===D)return G;return K=(K-W)/(X-W),K=Y(K),K=K*(D-G)+G,K}function RJ(J,j){let Q;for(Q=1;Q<j.length-1;++Q)if(j[Q]>=J)break;return Q-1}var PJ=(J)=>J,mj=(J)=>{return J.remotionShouldExtendRight===!0},wj=({easing:J,segmentIndex:j})=>{if(J===void 0)return PJ;if(typeof J==="function")return J;return J[j]},Fj=({input:J,inputRange:j,outputRange:Q,easing:$,extrapolateLeft:Z,extrapolateRight:H})=>{return yJ(J,j,Q,{easing:$,extrapolateLeft:Z,extrapolateRight:J>j[1]&&H==="clamp"&&mj($)?"extend":H})},zj=({input:J,inputRange:j,outputRange:Q,options:$})=>{if(j.length===1)return Q[0];let Z=$?.easing,H="extend";if($?.extrapolateLeft!==void 0)H=$.extrapolateLeft;let Y="extend";if($?.extrapolateRight!==void 0)Y=$.extrapolateRight;let K=$?.posterize===void 0?J:Math.floor(J/$.posterize)*$.posterize,W=RJ(K,j),X=wj({easing:Z,segmentIndex:W}),G=Fj({input:K,inputRange:[j[W],j[W+1]],outputRange:[Q[W],Q[W+1]],easing:X,extrapolateLeft:H,extrapolateRight:Y});for(let D=0;D<W;D++){let _=wj({easing:Z,segmentIndex:D});if(!mj(_))continue;let T=j[D+1];if(K<=T)continue;let E=Fj({input:K,inputRange:[j[D],T],outputRange:[Q[D],Q[D+1]],easing:_,extrapolateLeft:H,extrapolateRight:"extend"});G+=E-Q[D+1]}return G},xJ=({input:J,inputRange:j,outputRange:Q,options:$})=>{let Z=Q.map(wJ),H=Z[0]?.kind;if(H===void 0)throw Error("outputRange must have at least 1 element");for(let W of Z)if(W.kind!==H)throw TypeError(`Cannot interpolate ${H} values with ${W.kind} values`);let Y=Math.max(...Z.map((W)=>W.dimensions)),K=[null,null,null];if(H!=="scale")for(let W=0;W<Y;W++){for(let X of Z){let G=X.units[W];if(G===null)continue;if(K[W]===null){K[W]=G;continue}if(K[W]!==G)throw TypeError(`Cannot interpolate ${H} values with different units on axis ${W+1}: ${K[W]} and ${G}`)}if(K[W]===null)throw TypeError(`Cannot interpolate ${H} values because axis ${W+1} has no unit`)}return FJ({kind:H,values:[0,0,0].map((W,X)=>zj({input:J,inputRange:j,outputRange:Z.map((G)=>G.values[X]),options:$})),units:K,dimensions:Y})},IJ=(J)=>{let j=J[0]?.length;if(j===void 0)throw Error("outputRange must have at least 1 element");if(j===0)throw TypeError("outputRange tuples must contain at least 1 number");for(let Q of J){if(Q.length!==j)throw TypeError(`outputRange tuples must all have the same length, but got ${j} and ${Q.length}`);for(let $ of Q)if(typeof $!=="number"||!Number.isFinite($))throw TypeError(`outputRange tuples must contain only finite numbers, but got [${Q.join(",")}]`)}return j},fJ=({input:J,inputRange:j,outputRange:Q,options:$})=>{let Z=IJ(Q);return Array(Z).fill(!0).map((H,Y)=>zj({input:J,inputRange:j,outputRange:Q.map((K)=>K[Y]),options:$}))};function vJ(J){for(let j=1;j<J.length;++j)if(!(J[j]>J[j-1]))throw Error(`inputRange must be strictly monotonically increasing but got [${J.join(",")}]`)}function yj(J,j){if(j.length<1)throw Error(J+" must have at least 1 element");for(let Q of j){if(typeof Q!=="number")throw Error(`${J} must contain only numbers`);if(!Number.isFinite(Q))throw Error(`${J} must contain only finite numbers, but got [${j.join(",")}]`)}}function hJ(J,j){if(J===void 0)return;if(typeof J==="function")return;let Q=j-1;if(J.length!==Q)throw Error(`When easing is an array, it must have one entry per segment between keyframes (length inputRange.length - 1 = ${Q}), but got length ${J.length}`);for(let $=0;$<J.length;$++)if(typeof J[$]!=="function")throw Error(`easing[${$}] must be a function`)}function dJ(J){if(J===void 0)return;if(typeof J!=="number"||!Number.isFinite(J)||J<=0)throw Error(`posterize must be a positive finite number, but got ${J}`)}function cJ(J,j,Q,$){if(typeof J>"u")throw Error("input can not be undefined");if(typeof j>"u")throw Error("inputRange can not be undefined");if(typeof Q>"u")throw Error("outputRange can not be undefined");if(j.length!==Q.length)throw Error("inputRange ("+j.length+") and outputRange ("+Q.length+") must have the same length");if(yj("inputRange",j),vJ(j),hJ($?.easing,j.length),dJ($?.posterize),typeof J!=="number")throw TypeError("Cannot interpolate an input which is not a number");if(!Array.isArray(Q))throw Error("outputRange must contain only numbers");if(Q.some((H)=>typeof H==="string")){if(!Q.every((H)=>typeof H==="string"||typeof H==="number"))throw TypeError("outputRange must contain only numbers, or supported scale, translate, and rotate strings");return xJ({input:J,inputRange:j,outputRange:Q,options:$})}if(Q.every((H)=>Array.isArray(H)))return fJ({input:J,inputRange:j,outputRange:Q,options:$});if(!Q.every((H)=>typeof H==="number"))throw TypeError("outputRange must contain only numbers, numeric tuples, or supported scale, translate, and rotate strings");return yj("outputRange",Q),zj({input:J,inputRange:j,outputRange:Q,options:$})}function uJ(J){return Boolean(J)}if(typeof window<"u"){if(window.remotion_renderReady=!1,!window.remotion_delayRenderTimeouts)window.remotion_delayRenderTimeouts={};window.remotion_delayRenderHandles=[]}var mJ="The delayRender was called:",iJ="Retries left: ",pJ="- Rendering the frame will be retried.",sJ="handle was cleared after",oJ=({schema:J,key:j,value:Q})=>{let $=J[j];if(!$)throw Error("Key "+JSON.stringify(j)+" not found in schema");if(typeof Q!=="string")throw Error("Value must be a string, but is "+JSON.stringify(Q));if($.type!=="enum")throw Error("Key "+JSON.stringify(j)+" is not an enum");if(!$.variants[Q])throw Error("Value for "+JSON.stringify(j)+" must be one of "+Object.keys($.variants).map((K)=>JSON.stringify(K)).join(", ")+", got "+JSON.stringify(Q));let H=Object.keys($.variants).filter((K)=>K!==Q),Y=new Set;for(let K of H){let W=$.variants[K],X=Object.keys(W);for(let G of X)Y.add(G)}return[...Y]},Xj="remotion-date:",Gj="remotion-file:",lJ=({data:J,indent:j,staticBase:Q})=>{let $=!1,Z=!1,H=!1,Y=!1;try{return{serializedString:JSON.stringify(J,function(W,X){let G=this[W];if(G instanceof Date)return $=!0,`${Xj}${G.toISOString()}`;if(G instanceof Map)return H=!0,X;if(G instanceof Set)return Y=!0,X;if(typeof G==="string"&&Q!==null&&G.startsWith(Q))return Z=!0,`${Gj}${G.replace(Q+"/","")}`;return X},j),customDateUsed:$,customFileUsed:Z,mapUsed:H,setUsed:Y}}catch(K){throw Error("Could not serialize the passed input props to JSON: "+K.message)}},gJ=(J)=>{return JSON.parse(J,(j,Q)=>{if(typeof Q==="string"&&Q.startsWith(Xj))return new Date(Q.replace(Xj,""));if(typeof Q==="string"&&Q.startsWith(Gj))return`${window.remotion_staticBase}/${Q.replace(Gj,"")}`;return Q})},nJ={"style.transformOrigin":{type:"transform-origin",step:1,default:"50% 50%",description:"Transform origin"},"style.translate":{type:"translate",step:1,default:"0px 0px",description:"Offset"},"style.scale":{type:"scale",max:100,step:0.01,default:1,description:"Scale"},"style.rotate":{type:"rotation-css",step:1,default:"0deg",description:"Rotation"},"style.opacity":{type:"number",min:0,max:1,step:0.01,default:1,description:"Opacity",hiddenFromList:!1}},rJ={premountFor:{type:"number",default:0,description:"Premount For",min:0,step:1,hiddenFromList:!1},postmountFor:{type:"number",default:0,min:0,step:1,hiddenFromList:!0},styleWhilePremounted:{type:"hidden"},styleWhilePostmounted:{type:"hidden"}},tJ={...nJ,...rJ},ij={type:"boolean",default:!1,description:"Hidden"},pj={type:"hidden"},sj={type:"hidden"},oj={type:"number",default:void 0,min:1,step:1,hiddenFromList:!0},aJ={type:"number",default:0,step:1,hiddenFromList:!0},lj={type:"number",default:0,min:0,step:1,hiddenFromList:!0},gj={type:"number",default:null,step:1,hiddenFromList:!0},eJ={durationInFrames:oj,from:aJ,trimBefore:lj,freeze:gj,hidden:ij,name:sj,showInTimeline:pj},Bj={...eJ,layout:{type:"enum",default:"absolute-fill",description:"Layout",variants:{"absolute-fill":tJ,none:{}}}},jQ={durationInFrames:oj,trimBefore:lj,freeze:gj,hidden:ij,name:sj,showInTimeline:pj},N0={...jQ,layout:Bj.layout},T0={...Bj,layout:{...Bj.layout,default:"none"}},P="[-+]?\\d*\\.?\\d+",$j=P+"%";function Zj(...J){return"\\(\\s*("+J.join(")\\s*,\\s*(")+")\\s*\\)"}var Hj="(?:none|[-+]?\\d*\\.?\\d+(?:%|deg|rad|grad|turn)?)";function r(J){return new RegExp(J+"\\(\\s*("+Hj+")\\s+("+Hj+")\\s+("+Hj+")(?:\\s*\\/\\s*("+Hj+"))?\\s*\\)")}function JQ(){let J={rgb:void 0,rgba:void 0,hsl:void 0,hsla:void 0,hex3:void 0,hex4:void 0,hex5:void 0,hex6:void 0,hex8:void 0,oklch:void 0,oklab:void 0,lab:void 0,lch:void 0,hwb:void 0};if(J.rgb===void 0)J.rgb=new RegExp("rgb"+Zj(P,P,P)),J.rgba=new RegExp("rgba"+Zj(P,P,P,P)),J.hsl=new RegExp("hsl"+Zj(P,$j,$j)),J.hsla=new RegExp("hsla"+Zj(P,$j,$j,P)),J.hex3=/^#([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,J.hex4=/^#([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,J.hex6=/^#([0-9a-fA-F]{6})$/,J.hex8=/^#([0-9a-fA-F]{8})$/,J.oklch=r("oklch"),J.oklab=r("oklab"),J.lab=r("lab"),J.lch=r("lch"),J.hwb=r("hwb");return J}function s(J,j,Q){if(Q<0)Q+=1;if(Q>1)Q-=1;if(Q<0.16666666666666666)return J+(j-J)*6*Q;if(Q<0.5)return j;if(Q<0.6666666666666666)return J+(j-J)*(0.6666666666666666-Q)*6;return J}function Rj(J,j,Q){let $=Q<0.5?Q*(1+j):Q+j-Q*j,Z=2*Q-$,H=s(Z,$,J+0.3333333333333333),Y=s(Z,$,J),K=s(Z,$,J-0.3333333333333333);return Math.round(H*255)<<24|Math.round(Y*255)<<16|Math.round(K*255)<<8}function i(J){let j=Number.parseInt(J,10);if(j<0)return 0;if(j>255)return 255;return j}function Pj(J){return(Number.parseFloat(J)%360+360)%360/360}function xj(J){let j=Number.parseFloat(J);if(j<0)return 0;if(j>1)return 255;return Math.round(j*255)}function Kj(J){let j=Number.parseFloat(J);if(j<0)return 0;if(j>100)return 1;return j/100}function R(J,j){if(J==="none")return 0;if(J.endsWith("%"))return Number.parseFloat(J)/100*j;return Number.parseFloat(J)}function Aj(J){if(J==="none")return 0;if(J.endsWith("rad"))return Number.parseFloat(J)*180/Math.PI;if(J.endsWith("grad"))return Number.parseFloat(J)*0.9;if(J.endsWith("turn"))return Number.parseFloat(J)*360;return Number.parseFloat(J)}function t(J){if(J===void 0||J==="none")return 1;if(J.endsWith("%"))return Math.max(0,Math.min(1,Number.parseFloat(J)/100));return Math.max(0,Math.min(1,Number.parseFloat(J)))}function o(J){if(J<=0.0031308)return 12.92*J;return 1.055*J**0.4166666666666667-0.055}function Wj(J){return Math.max(0,Math.min(1,J))}function a(J,j,Q,$){let Z=Math.round(Wj(J)*255),H=Math.round(Wj(j)*255),Y=Math.round(Wj(Q)*255),K=Math.round(Wj($)*255);return(Z<<24|H<<16|Y<<8|K)>>>0}function Ij(J,j,Q){let $=J+0.3963377774*j+0.2158037573*Q,Z=J-0.1055613458*j-0.0638541728*Q,H=J-0.0894841775*j-1.291485548*Q,Y=$*$*$,K=Z*Z*Z,W=H*H*H,X=4.0767416621*Y-3.3077115913*K+0.2309699292*W,G=-1.2684380046*Y+2.6097574011*K-0.3413193965*W,D=-0.0041960863*Y-0.7034186147*K+1.707614701*W;return[o(X),o(G),o(D)]}function fj(J,j,Q){let W=(J+16)/116,X=j/500+W,G=W-Q/200,D=X*X*X,_=G*G*G,T=D>0.008856451679035631?D:(116*X-16)/903.2962962962963,E=J>8?((J+16)/116)**3:J/903.2962962962963,V=_>0.008856451679035631?_:(116*G-16)/903.2962962962963,q=T*0.95047,N=E*1,B=V*1.08883,z=3.2404542*q-1.5371385*N-0.4985314*B,A=-0.969266*q+1.8760108*N+0.041556*B,U=0.0556434*q-0.2040259*N+1.0572252*B;return[o(z),o(A),o(U)]}function QQ(J,j,Q){if(j+Q>=1){let X=j/(j+Q);return[X,X,X]}let $=1,Z=0,H=s(Z,$,J+0.3333333333333333),Y=s(Z,$,J),K=s(Z,$,J-0.3333333333333333),W=1-j-Q;return[H*W+j,Y*W+j,K*W+j]}var Tj={transparent:0,aliceblue:4042850303,antiquewhite:4209760255,aqua:16777215,aquamarine:2147472639,azure:4043309055,beige:4126530815,bisque:4293182719,black:255,blanchedalmond:4293643775,blue:65535,blueviolet:2318131967,brown:2771004159,burlywood:3736635391,burntsienna:3934150143,cadetblue:1604231423,chartreuse:2147418367,chocolate:3530104575,coral:4286533887,cornflowerblue:1687547391,cornsilk:4294499583,crimson:3692313855,cyan:16777215,darkblue:35839,darkcyan:9145343,darkgoldenrod:3095792639,darkgray:2846468607,darkgreen:6553855,darkgrey:2846468607,darkkhaki:3182914559,darkmagenta:2332068863,darkolivegreen:1433087999,darkorange:4287365375,darkorchid:2570243327,darkred:2332033279,darksalmon:3918953215,darkseagreen:2411499519,darkslateblue:1211993087,darkslategray:793726975,darkslategrey:793726975,darkturquoise:13554175,darkviolet:2483082239,deeppink:4279538687,deepskyblue:12582911,dimgray:1768516095,dimgrey:1768516095,dodgerblue:512819199,firebrick:2988581631,floralwhite:4294635775,forestgreen:579543807,fuchsia:4278255615,gainsboro:3705462015,ghostwhite:4177068031,gold:4292280575,goldenrod:3668254975,gray:2155905279,green:8388863,greenyellow:2919182335,grey:2155905279,honeydew:4043305215,hotpink:4285117695,indianred:3445382399,indigo:1258324735,ivory:4294963455,khaki:4041641215,lavender:3873897215,lavenderblush:4293981695,lawngreen:2096890111,lemonchiffon:4294626815,lightblue:2916673279,lightcoral:4034953471,lightcyan:3774873599,lightgoldenrodyellow:4210742015,lightgray:3553874943,lightgreen:2431553791,lightgrey:3553874943,lightpink:4290167295,lightsalmon:4288707327,lightseagreen:548580095,lightskyblue:2278488831,lightslategray:2005441023,lightslategrey:2005441023,lightsteelblue:2965692159,lightyellow:4294959359,lime:16711935,limegreen:852308735,linen:4210091775,magenta:4278255615,maroon:2147483903,mediumaquamarine:1724754687,mediumblue:52735,mediumorchid:3126187007,mediumpurple:2473647103,mediumseagreen:1018393087,mediumslateblue:2070474495,mediumspringgreen:16423679,mediumturquoise:1221709055,mediumvioletred:3340076543,midnightblue:421097727,mintcream:4127193855,mistyrose:4293190143,moccasin:4293178879,navajowhite:4292783615,navy:33023,oldlace:4260751103,olive:2155872511,olivedrab:1804477439,orange:4289003775,orangered:4282712319,orchid:3664828159,palegoldenrod:4008225535,palegreen:2566625535,paleturquoise:2951671551,palevioletred:3681588223,papayawhip:4293907967,peachpuff:4292524543,peru:3448061951,pink:4290825215,plum:3718307327,powderblue:2967529215,purple:2147516671,rebeccapurple:1714657791,red:4278190335,rosybrown:3163525119,royalblue:1097458175,saddlebrown:2336560127,salmon:4202722047,sandybrown:4104413439,seagreen:780883967,seashell:4294307583,sienna:2689740287,silver:3233857791,skyblue:2278484991,slateblue:1784335871,slategray:1887473919,slategrey:1887473919,snow:4294638335,springgreen:16744447,steelblue:1182971135,tan:3535047935,teal:8421631,thistle:3636451583,tomato:4284696575,turquoise:1088475391,violet:4001558271,wheat:4125012991,white:4294967295,whitesmoke:4126537215,yellow:4294902015,yellowgreen:2597139199};function $Q(J){let j=JQ(),Q;if(j.hex6){if(Q=j.hex6.exec(J))return Number.parseInt(Q[1]+"ff",16)>>>0}if(Tj[J]!==void 0)return Tj[J];if(j.rgb){if(Q=j.rgb.exec(J))return(i(Q[1])<<24|i(Q[2])<<16|i(Q[3])<<8|255)>>>0}if(j.rgba){if(Q=j.rgba.exec(J))return(i(Q[1])<<24|i(Q[2])<<16|i(Q[3])<<8|xj(Q[4]))>>>0}if(j.hex3){if(Q=j.hex3.exec(J))return Number.parseInt(Q[1]+Q[1]+Q[2]+Q[2]+Q[3]+Q[3]+"ff",16)>>>0}if(j.hex8){if(Q=j.hex8.exec(J))return Number.parseInt(Q[1],16)>>>0}if(j.hex4){if(Q=j.hex4.exec(J))return Number.parseInt(Q[1]+Q[1]+Q[2]+Q[2]+Q[3]+Q[3]+Q[4]+Q[4],16)>>>0}if(j.hsl){if(Q=j.hsl.exec(J))return(Rj(Pj(Q[1]),Kj(Q[2]),Kj(Q[3]))|255)>>>0}if(j.hsla){if(Q=j.hsla.exec(J))return(Rj(Pj(Q[1]),Kj(Q[2]),Kj(Q[3]))|xj(Q[4]))>>>0}if(j.oklch){if(Q=j.oklch.exec(J)){let $=R(Q[1],1),Z=R(Q[2],0.4),H=Aj(Q[3]),Y=t(Q[4]),K=H*Math.PI/180,[W,X,G]=Ij($,Z*Math.cos(K),Z*Math.sin(K));return a(W,X,G,Y)}}if(j.oklab){if(Q=j.oklab.exec(J)){let $=R(Q[1],1),Z=R(Q[2],0.4),H=R(Q[3],0.4),Y=t(Q[4]),[K,W,X]=Ij($,Z,H);return a(K,W,X,Y)}}if(j.lab){if(Q=j.lab.exec(J)){let $=R(Q[1],100),Z=R(Q[2],125),H=R(Q[3],125),Y=t(Q[4]),[K,W,X]=fj($,Z,H);return a(K,W,X,Y)}}if(j.lch){if(Q=j.lch.exec(J)){let $=R(Q[1],100),Z=R(Q[2],150),H=Aj(Q[3]),Y=t(Q[4]),K=H*Math.PI/180,[W,X,G]=fj($,Z*Math.cos(K),Z*Math.sin(K));return a(W,X,G,Y)}}if(j.hwb){if(Q=j.hwb.exec(J)){let $=Aj(Q[1]),Z=R(Q[2],1),H=R(Q[3],1),Y=t(Q[4]),[K,W,X]=QQ($/360,Z,H);return a(K,W,X,Y)}}throw Error(`invalid color string ${J} provided`)}function ZQ(J){let j=$Q(J);return(j<<24|j>>>8)>>>0}var HQ=["4444-xq","4444","hq","standard","light","proxy"],KQ=[1,1,1],WQ=(J)=>{let j=J.trim().split(/\s+/);if(j.length<1||j.length>3||j[0]==="")return null;let Q=j.map((Y)=>Number(Y));if(!Q.every((Y)=>Number.isFinite(Y)))return null;let $=Q[0],Z=Q[1]??$,H=Q[2]??1;return[$,Z,H]},YQ=(J)=>{if(typeof J==="number")return Number.isFinite(J)?[J,J,1]:null;if(typeof J==="string")return WQ(J);return null},XQ=(J)=>{return YQ(J)??KQ},GQ=([J,j,Q])=>{let $=Yj(J),Z=Yj(j),H=Yj(Q);if($===Z&&H===1)return $;if(H===1)return`${$} ${Z}`;return`${$} ${Z} ${H}`},Nj=!1,BQ=({allowFloats:J,durationInFrames:j,frame:Q})=>{if(typeof Q>"u")throw TypeError('Argument missing for parameter "frame"');if(typeof Q!=="number")throw TypeError(`Argument passed for "frame" is not a number: ${Q}`);if(!Number.isFinite(Q))throw RangeError(`Frame ${Q} is not finite`);if(Q%1!==0&&!J)throw RangeError(`Argument for frame must be an integer, but got ${Q}`);if(Q<0&&Q<-j)throw RangeError(`Cannot use frame ${Q}: Duration of composition is ${j}, therefore the lowest frame that can be rendered is ${-j}`);if(Q>j-1)throw RangeError(`Cannot use frame ${Q}: Duration of composition is ${j}, therefore the highest frame that can be rendered is ${j-1}`)},vj=["h264","h265","vp8","vp9","av1","mp3","aac","wav","prores","h264-mkv","h264-ts","gif"];function DQ(J,j,Q){if(typeof J>"u")return;if(typeof J!=="string")throw TypeError(`The "${Q}" prop ${j} must be a string, but you passed a value of type ${typeof J}.`);if(!vj.includes(J))throw Error(`The "${Q}" prop ${j} must be one of ${vj.join(", ")}, but you passed ${J}.`)}var _Q=(J,j,Q)=>{if(!J)return;if(typeof J!=="object")throw Error(`"${j}" must be an object, but you passed a value of type ${typeof J}`);if(Array.isArray(J))throw Error(`"${j}" must be an object, an array was passed ${Q?`for composition "${Q}"`:""}`)};function UQ(J,j,Q){if(typeof J!=="number")throw Error(`The "${j}" prop ${Q} must be a number, but you passed a value of type ${typeof J}`);if(isNaN(J))throw TypeError(`The "${j}" prop ${Q} must not be NaN, but is NaN.`);if(!Number.isFinite(J))throw TypeError(`The "${j}" prop ${Q} must be finite, but is ${J}.`);if(J%1!==0)throw TypeError(`The "${j}" prop ${Q} must be an integer, but is ${J}.`);if(J<=0)throw TypeError(`The "${j}" prop ${Q} must be positive, but got ${J}.`)}function VQ(J,j){let{allowFloats:Q,component:$}=j;if(typeof J>"u")throw Error(`The "durationInFrames" prop ${$} is missing.`);if(typeof J!=="number")throw Error(`The "durationInFrames" prop ${$} must be a number, but you passed a value of type ${typeof J}`);if(J<=0)throw TypeError(`The "durationInFrames" prop ${$} must be positive, but got ${J}.`);if(!Q&&J%1!==0)throw TypeError(`The "durationInFrames" prop ${$} must be an integer, but got ${J}.`);if(!Number.isFinite(J))throw TypeError(`The "durationInFrames" prop ${$} must be finite, but got ${J}.`)}function qQ(J,j,Q){if(typeof J!=="number")throw Error(`"fps" must be a number, but you passed a value of type ${typeof J} ${j}`);if(!Number.isFinite(J))throw Error(`"fps" must be a finite, but you passed ${J} ${j}`);if(isNaN(J))throw Error(`"fps" must not be NaN, but got ${J} ${j}`);if(J<=0)throw TypeError(`"fps" must be positive, but got ${J} ${j}`);if(Q&&J>50)throw TypeError("The FPS for a GIF cannot be higher than 50. Use the --every-nth-frame option to lower the FPS: https://remotion.dev/docs/render-as-gif")}var AQ=({frame:J,playbackRate:j,startFrom:Q})=>{return cJ(J,[-1,Q,Q+1],[-1,Q,Q+j])},NQ=(J)=>{if(typeof window>"u")return J;if(J.startsWith("http://")||J.startsWith("https://")||J.startsWith("file://")||J.startsWith("blob:")||J.startsWith("data:"))return J;return new URL(J,window.origin).href},TQ=({src:J,transparent:j,currentTime:Q,toneMapped:$})=>{return`http://localhost:${window.remotion_proxyPort}/proxy?src=${encodeURIComponent(NQ(J))}&time=${encodeURIComponent(Math.max(0,Q))}&transparent=${String(j)}&toneMapped=${String($)}`},Dj={processColor:ZQ,truthy:uJ,validateFps:qQ,validateDimension:UQ,validateDurationInFrames:VQ,validateDefaultAndInputProps:_Q,validateFrame:BQ,serializeJSONWithSpecialTypes:lJ,bundleName:"bundle.js",bundleMapName:"bundle.js.map",deserializeJSONWithSpecialTypes:gJ,DELAY_RENDER_CALLSTACK_TOKEN:mJ,DELAY_RENDER_RETRY_TOKEN:pJ,DELAY_RENDER_CLEAR_TOKEN:sJ,DELAY_RENDER_ATTEMPT_TOKEN:iJ,getOffthreadVideoSource:TQ,getExpectedMediaFrameUncorrected:AQ,ENABLE_V5_BREAKING_CHANGES:Nj,MIN_NODE_VERSION:Nj?18:16,MIN_BUN_VERSION:Nj?"1.1.3":"1.0.3",colorNames:Tj,DATE_TOKEN:Xj,FILE_TOKEN:Gj,validateCodec:DQ,proResProfileOptions:HQ,findPropsToDelete:oJ,sequenceSchema:Bj,parseScaleValue:XQ,serializeScaleValue:GQ};import DJ,{useMemo as _J}from"react";import{jsx as UJ}from"react/jsx-runtime";import XJ from"react";import{jsx as b,Fragment as NJ}from"react/jsx-runtime";import BJ from"react";var LQ=0.01,OQ=({children:J,presentationProgress:j,presentationDirection:Q,passedProps:{direction:$="from-left",enterStyle:Z,exitStyle:H}})=>{let Y=nj(()=>{let W=j===1?j*100:j*100-LQ;if(Q==="exiting")switch($){case"from-left":return{transform:`translateX(${W}%)`};case"from-right":return{transform:`translateX(${-j*100}%)`};case"from-top":return{transform:`translateY(${W}%)`};case"from-bottom":return{transform:`translateY(${-j*100}%)`};default:throw Error(`Invalid direction: ${$}`)}switch($){case"from-left":return{transform:`translateX(${-100+j*100}%)`};case"from-right":return{transform:`translateX(${100-W}%)`};case"from-top":return{transform:`translateY(${-100+j*100}%)`};case"from-bottom":return{transform:`translateY(${100-W}%)`};default:throw Error(`Invalid direction: ${$}`)}},[Q,j,$]),K=nj(()=>{return{width:"100%",height:"100%",justifyContent:"center",alignItems:"center",...Y,...Q==="entering"?Z:H}},[Y,Z,H,Q]);return MQ(zQ,{style:K,children:J})},_j=(J)=>{return{component:OQ,props:J??{}}},FQ=({children:J,onElementImage:j,onUnmount:Q,presentationProgress:$,presentationDirection:Z,shader:H,effects:Y,passedProps:K,bothEnteringAndExiting:W})=>{if(!SQ.isSupported())throw Error(kQ);let X=Mj(null),G=CQ(()=>{return{width:"100%",height:"100%",position:"absolute",top:0,left:0,right:0,bottom:0}},[]),[D]=rj(()=>new OffscreenCanvas(1,1)),_=Mj(K);_.current=K;let T=Lj.useMemoizedEffects({effects:Y??[],overrideId:null}),E=Mj(T);E.current=T;let[V]=rj(()=>H(D));e(()=>{return()=>{V.cleanup()}},[D,V]);let q=Lj.useEffectChainState(),{delayRender:N,continueRender:B}=wQ(),z=bQ(async(U,O,w)=>{if(!X.current)throw Error("Canvas not found");let M=N("onPaint");if(!U&&!O){B(M),V.clear();return}let L=U?.width??O?.width??0,x=U?.height??O?.height??0;if(L===0||x===0){B(M),V.clear();return}D.width=L,D.height=x,V.draw({prevImage:U,nextImage:O,width:L,height:x,time:w,passedProps:_.current}),await Lj.runEffectChain({state:q.get(L,x),source:D,effects:E.current??[],width:L,height:x,output:X.current}),B(M)},[q,V,D,B,N]),A=W&&Z==="exiting";if(e(()=>{if(A)return;let U=X.current;if(!U)throw Error("Canvas not found");U.layoutSubtree=!0;let O=()=>{let w=U.firstChild;if(!w)return;let M=U.captureElementImage(w);j(M,z)};return U.addEventListener("paint",O),()=>{U.removeEventListener("paint",O)}},[j,Z,z,A]),e(()=>{if(A)return;let U=X.current;if(!U)throw Error("Canvas not found");U.requestPaint?.()},[$,A,T]),e(()=>{if(A)return;return()=>{Q()}},[Q,A]),e(()=>{if(A)return;let U=X.current;if(!U)return;new ResizeObserver(([w])=>{U.width=w.devicePixelContentBoxSize[0].inlineSize,U.height=w.devicePixelContentBoxSize[0].blockSize}).observe(U,{box:"device-pixel-content-box"})},[A]),A)return J;return bj(EQ,{children:bj("canvas",{ref:X,style:G,children:J})})},Jj=(J)=>{let j=(Q)=>{let{passedProps:$,...Z}=Q,{effects:H,...Y}=Q.passedProps;return bj(FQ,{shader:J,passedProps:Y,effects:H,...Z})};return(Q)=>{return{component:j,props:Q}}},yQ=0.4,RQ=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
	v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
	gl_Position = vec4(a_pos, 0.0, 1.0);
}`,PQ=`#version 300 es
precision highp float;

uniform sampler2D u_prev;
uniform sampler2D u_next;
uniform float u_time;
uniform float u_strength;

in vec2 v_uv;
out vec4 outColor;

const float PI = 3.141592653589793;

float linearEase(float begin, float change, float duration, float time) {
	return change * time / duration + begin;
}

float exponentialEaseInOut(float begin, float change, float duration, float time) {
	if (time == 0.0) {
		return begin;
	}

	if (time == duration) {
		return begin + change;
	}

	float t = time / (duration / 2.0);
	if (t < 1.0) {
		return change / 2.0 * pow(2.0, 10.0 * (t - 1.0)) + begin;
	}

	return change / 2.0 * (-pow(2.0, -10.0 * (t - 1.0)) + 2.0) + begin;
}

float sinusoidalEaseInOut(float begin, float change, float duration, float time) {
	return -change / 2.0 * (cos(PI * time / duration) - 1.0) + begin;
}

float random(vec2 co) {
	return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

vec4 crossFade(vec2 uv, float dissolve) {
	return mix(texture(u_prev, uv), texture(u_next, uv), dissolve);
}

vec4 transition(vec2 uv, float progress) {
	vec2 center = vec2(linearEase(0.25, 0.5, 1.0, progress), 0.5);
	float dissolve = exponentialEaseInOut(0.0, 1.0, 1.0, progress);
	float strength = sinusoidalEaseInOut(0.0, u_strength, 0.5, progress);

	vec4 color = vec4(0.0);
	float total = 0.0;
	vec2 toCenter = center - uv;
	float offset = random(uv);

	for (int i = 0; i <= 40; i++) {
		float percent = (float(i) + offset) / 40.0;
		float weight = 4.0 * (percent - percent * percent);
		color += crossFade(uv + toCenter * percent * strength, dissolve) * weight;
		total += weight;
	}

	return color / total;
}

void main() {
	float progress = 1.0 - u_time;
	outColor = transition(v_uv, progress);
}`,tj=(J,j,Q)=>{let $=J.createShader(Q);if(!$)throw Error("Failed to create shader");if(J.shaderSource($,j),J.compileShader($),!J.getShaderParameter($,J.COMPILE_STATUS)){let Z=J.getShaderInfoLog($);throw J.deleteShader($),Error(`Failed to compile shader: ${Z}`)}return $},xQ=(J)=>{let j=J.createProgram();if(!j)throw Error("Failed to create WebGL program");let Q=tj(J,RQ,J.VERTEX_SHADER),$=tj(J,PQ,J.FRAGMENT_SHADER);if(J.attachShader(j,Q),J.attachShader(j,$),J.linkProgram(j),!J.getProgramParameter(j,J.LINK_STATUS)){let Z=J.getProgramInfoLog(j);throw J.deleteProgram(j),Error(`Failed to link program: ${Z}`)}return j},aj=(J)=>{let j=J.createTexture();if(!j)throw Error("Failed to create texture");return J.bindTexture(J.TEXTURE_2D,j),J.texParameteri(J.TEXTURE_2D,J.TEXTURE_WRAP_S,J.CLAMP_TO_EDGE),J.texParameteri(J.TEXTURE_2D,J.TEXTURE_WRAP_T,J.CLAMP_TO_EDGE),J.texParameteri(J.TEXTURE_2D,J.TEXTURE_MIN_FILTER,J.LINEAR),J.texParameteri(J.TEXTURE_2D,J.TEXTURE_MAG_FILTER,J.LINEAR),J.texImage2D(J.TEXTURE_2D,0,J.RGBA,1,1,0,J.RGBA,J.UNSIGNED_BYTE,new Uint8Array([0,0,0,0])),j},IQ=(J)=>{let j=J.getContext("webgl2",{premultipliedAlpha:!0});if(!j)throw Error("Failed to create WebGL2 context");let Q=xQ(j),$=aj(j),Z=aj(j),H=j.createVertexArray();j.bindVertexArray(H);let Y=j.createBuffer();j.bindBuffer(j.ARRAY_BUFFER,Y),j.bufferData(j.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),j.STATIC_DRAW);let K=j.getAttribLocation(Q,"a_pos");j.enableVertexAttribArray(K),j.vertexAttribPointer(K,2,j.FLOAT,!1,0,0);let W=j.getUniformLocation(Q,"u_time"),X=j.getUniformLocation(Q,"u_prev"),G=j.getUniformLocation(Q,"u_next"),D=j.getUniformLocation(Q,"u_strength");return{clear:()=>{j.clearColor(0,0,0,0),j.clear(j.COLOR_BUFFER_BIT)},cleanup:()=>{j.deleteProgram(Q),j.deleteTexture($),j.deleteTexture(Z)},draw:({prevImage:V,nextImage:q,width:N,height:B,time:z,passedProps:A})=>{let{strength:U=yQ}=A;if(!V&&!q)return;if(V&&(V.width===0||V.height===0))return;if(q&&(q.width===0||q.height===0))return;let O=!V?0:!q?1:z;if(j.viewport(0,0,N,B),j.clearColor(0,0,0,0),j.clear(j.COLOR_BUFFER_BIT),j.useProgram(Q),j.activeTexture(j.TEXTURE0),j.bindTexture(j.TEXTURE_2D,$),V)j.texElementImage2D(j.TEXTURE_2D,0,j.RGBA,j.RGBA,j.UNSIGNED_BYTE,V);if(j.uniform1i(X,0),j.activeTexture(j.TEXTURE1),j.bindTexture(j.TEXTURE_2D,Z),q)j.texElementImage2D(j.TEXTURE_2D,0,j.RGBA,j.RGBA,j.UNSIGNED_BYTE,q);j.uniform1i(G,1),j.uniform1f(W,O),j.uniform1f(D,U),j.drawArrays(j.TRIANGLE_STRIP,0,4)}}},fQ=Jj(IQ),vQ=6,hQ=1.2,dQ=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
	v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
	gl_Position = vec4(a_pos, 0.0, 1.0);
}`,cQ=`#version 300 es
precision highp float;

uniform sampler2D u_prev;
uniform sampler2D u_next;
uniform float u_time;
uniform float u_rotation;
uniform float u_scale;
uniform float u_ratio;

in vec2 v_uv;
out vec4 outColor;

const float DEG2RAD = 0.03926990816987241548078304229099;

vec4 transition(vec2 uv, float progress) {
	float phase = progress < 0.5 ? progress * 2.0 : (progress - 0.5) * 2.0;
	float angleOffset = progress < 0.5 ? mix(0.0, u_rotation * DEG2RAD, phase) : mix(-u_rotation * DEG2RAD, 0.0, phase);
	float newScale = progress < 0.5 ? mix(1.0, u_scale, phase) : mix(u_scale, 1.0, phase);

	vec2 center = vec2(0.0, 0.0);
	vec2 p = (uv.xy - vec2(0.5, 0.5)) / newScale * vec2(u_ratio, 1.0);
	float angle = atan(p.y, p.x) + angleOffset;
	float dist = distance(center, p);

	p.x = cos(angle) * dist / u_ratio + 0.5;
	p.y = sin(angle) * dist + 0.5;

	vec4 c = progress < 0.5 ? texture(u_prev, p) : texture(u_next, p);
	return c + (progress < 0.5 ? mix(0.0, 1.0, phase) : mix(1.0, 0.0, phase));
}

void main() {
	float progress = 1.0 - u_time;
	outColor = transition(v_uv, progress);
}`,ej=(J,j,Q)=>{let $=J.createShader(Q);if(!$)throw Error("Failed to create shader");if(J.shaderSource($,j),J.compileShader($),!J.getShaderParameter($,J.COMPILE_STATUS)){let Z=J.getShaderInfoLog($);throw J.deleteShader($),Error(`Failed to compile shader: ${Z}`)}return $},uQ=(J)=>{let j=J.createProgram();if(!j)throw Error("Failed to create WebGL program");let Q=ej(J,dQ,J.VERTEX_SHADER),$=ej(J,cQ,J.FRAGMENT_SHADER);if(J.attachShader(j,Q),J.attachShader(j,$),J.linkProgram(j),!J.getProgramParameter(j,J.LINK_STATUS)){let Z=J.getProgramInfoLog(j);throw J.deleteProgram(j),Error(`Failed to link program: ${Z}`)}return j},jJ=(J)=>{let j=J.createTexture();if(!j)throw Error("Failed to create texture");return J.bindTexture(J.TEXTURE_2D,j),J.texParameteri(J.TEXTURE_2D,J.TEXTURE_WRAP_S,J.CLAMP_TO_EDGE),J.texParameteri(J.TEXTURE_2D,J.TEXTURE_WRAP_T,J.CLAMP_TO_EDGE),J.texParameteri(J.TEXTURE_2D,J.TEXTURE_MIN_FILTER,J.LINEAR),J.texParameteri(J.TEXTURE_2D,J.TEXTURE_MAG_FILTER,J.LINEAR),J.texImage2D(J.TEXTURE_2D,0,J.RGBA,1,1,0,J.RGBA,J.UNSIGNED_BYTE,new Uint8Array([0,0,0,0])),j},mQ=(J)=>{let j=J.getContext("webgl2",{premultipliedAlpha:!0});if(!j)throw Error("Failed to create WebGL2 context");let Q=uQ(j),$=jJ(j),Z=jJ(j),H=j.createVertexArray();j.bindVertexArray(H);let Y=j.createBuffer();j.bindBuffer(j.ARRAY_BUFFER,Y),j.bufferData(j.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),j.STATIC_DRAW);let K=j.getAttribLocation(Q,"a_pos");j.enableVertexAttribArray(K),j.vertexAttribPointer(K,2,j.FLOAT,!1,0,0);let W=j.getUniformLocation(Q,"u_time"),X=j.getUniformLocation(Q,"u_prev"),G=j.getUniformLocation(Q,"u_next"),D=j.getUniformLocation(Q,"u_rotation"),_=j.getUniformLocation(Q,"u_scale"),T=j.getUniformLocation(Q,"u_ratio");return{clear:()=>{j.clearColor(0,0,0,0),j.clear(j.COLOR_BUFFER_BIT)},cleanup:()=>{j.deleteProgram(Q),j.deleteTexture($),j.deleteTexture(Z)},draw:({prevImage:N,nextImage:B,width:z,height:A,time:U,passedProps:O})=>{let{rotation:w=vQ,scale:M=hQ}=O;if(!N&&!B)return;if(N&&(N.width===0||N.height===0))return;if(B&&(B.width===0||B.height===0))return;let L=!N?0:!B?1:U;if(j.viewport(0,0,z,A),j.clearColor(0,0,0,0),j.clear(j.COLOR_BUFFER_BIT),j.useProgram(Q),j.activeTexture(j.TEXTURE0),j.bindTexture(j.TEXTURE_2D,$),N)j.texElementImage2D(j.TEXTURE_2D,0,j.RGBA,j.RGBA,j.UNSIGNED_BYTE,N);if(j.uniform1i(X,0),j.activeTexture(j.TEXTURE1),j.bindTexture(j.TEXTURE_2D,Z),B)j.texElementImage2D(j.TEXTURE_2D,0,j.RGBA,j.RGBA,j.UNSIGNED_BYTE,B);j.uniform1i(G,1),j.uniform1f(W,L),j.uniform1f(D,w),j.uniform1f(_,M),j.uniform1f(T,z/A),j.drawArrays(j.TRIANGLE_STRIP,0,4)}}},iQ=Jj(mQ),pQ=2.31,sQ=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
	v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
	gl_Position = vec4(a_pos, 0.0, 1.0);
}`,oQ=`#version 300 es
precision highp float;

uniform sampler2D u_prev;
uniform sampler2D u_next;
uniform float u_time;
uniform float u_seed;

in vec2 v_uv;
out vec4 outColor;

#define PI 3.14159265358979323
#define CLAMPS(x) clamp(x, 0.0, 1.0)
#define REPEATS 50.0

float sigmoid(float x, float a) {
	float b = pow(x * 2.0, a) / 2.0;
	if (x > 0.5) {
		b = 1.0 - pow(2.0 - (x * 2.0), a) / 2.0;
	}
	return b;
}

float rand(float co) {
	return fract(sin((co * 24.9898) + u_seed) * 43758.5453);
}

float rand(vec2 co) {
	return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

float apow(float a, float b) {
	return pow(abs(a), b) * sign(b);
}

vec3 pow3(vec3 a, vec3 b) {
	return vec3(apow(a.r, b.r), apow(a.g, b.g), apow(a.b, b.b));
}

float smoothMix(float a, float b, float c) {
	return mix(a, b, sigmoid(c, 2.0));
}

float random(vec2 co, float shft) {
	co += 10.0;
	return smoothMix(
		fract(
			sin(
				dot(
					co.xy,
					vec2(12.9898 + (floor(shft) * 0.5), 78.233 + u_seed)
				)
			) * 43758.5453
		),
		fract(
			sin(
				dot(
					co.xy,
					vec2(12.9898 + (floor(shft + 1.0) * 0.5), 78.233 + u_seed)
				)
			) * 43758.5453
		),
		fract(shft)
	);
}

float smoothRandom(vec2 co, float shft) {
	return smoothMix(
		smoothMix(
			random(floor(co), shft),
			random(floor(co + vec2(1.0, 0.0)), shft),
			fract(co.x)
		),
		smoothMix(
			random(floor(co + vec2(0.0, 1.0)), shft),
			random(floor(co + vec2(1.0, 1.0)), shft),
			fract(co.x)
		),
		fract(co.y)
	);
}

vec4 sampleTexture(vec2 p, float progress) {
	return mix(texture(u_prev, p), texture(u_next, p), sigmoid(progress, 10.0));
}

vec4 transition(vec2 p, float progress) {
	vec3 f = vec3(0.0);
	for (float i = 0.0; i < 13.0; i++) {
		f += sin(((p.x * rand(i) * 6.0) + (progress * 8.0)) + rand(i + 1.43)) *
			sin(
				((p.y * rand(i + 4.4) * 6.0) + (progress * 6.0)) +
					rand(i + 2.4)
			);
		f += 1.0 - CLAMPS(
			length(
				p -
					vec2(
						smoothRandom(vec2(progress * 1.3), i + 1.0),
						smoothRandom(vec2(progress * 0.5), i + 6.25)
					)
			) * mix(20.0, 70.0, rand(i))
		);
	}

	f += 4.0;
	f /= 11.0;
	f = pow3(
		f * vec3(1.0, 0.7, 0.6),
		vec3(1.0, 2.0 - sin(progress * PI), 1.3)
	);
	f *= sin(progress * PI);

	p -= 0.5;
	p *= 1.0 + (smoothRandom(vec2(progress * 5.0), 6.3) * sin(progress * PI) * 0.05);
	p += 0.5;

	vec4 blurredImage = vec4(0.0);
	float blurAmount = sin(progress * PI) * 0.03;
	for (float i = 0.0; i < REPEATS; i++) {
		vec2 q = vec2(
			cos(degrees((i / REPEATS) * 360.0)),
			sin(degrees((i / REPEATS) * 360.0))
		) * (rand(vec2(i, p.x + p.y)) + blurAmount);
		vec2 uv2 = p + (q * blurAmount);
		blurredImage += sampleTexture(uv2, progress);
	}

	blurredImage /= REPEATS;
	return blurredImage + vec4(f, 0.0);
}

void main() {
	float progress = 1.0 - u_time;
	outColor = transition(v_uv, progress);
}`,JJ=(J,j,Q)=>{let $=J.createShader(Q);if(!$)throw Error("Failed to create shader");if(J.shaderSource($,j),J.compileShader($),!J.getShaderParameter($,J.COMPILE_STATUS)){let Z=J.getShaderInfoLog($);throw J.deleteShader($),Error(`Failed to compile shader: ${Z}`)}return $},lQ=(J)=>{let j=J.createProgram();if(!j)throw Error("Failed to create WebGL program");let Q=JJ(J,sQ,J.VERTEX_SHADER),$=JJ(J,oQ,J.FRAGMENT_SHADER);if(J.attachShader(j,Q),J.attachShader(j,$),J.linkProgram(j),!J.getProgramParameter(j,J.LINK_STATUS)){let Z=J.getProgramInfoLog(j);throw J.deleteProgram(j),Error(`Failed to link program: ${Z}`)}return j},QJ=(J)=>{let j=J.createTexture();if(!j)throw Error("Failed to create texture");return J.bindTexture(J.TEXTURE_2D,j),J.texParameteri(J.TEXTURE_2D,J.TEXTURE_WRAP_S,J.CLAMP_TO_EDGE),J.texParameteri(J.TEXTURE_2D,J.TEXTURE_WRAP_T,J.CLAMP_TO_EDGE),J.texParameteri(J.TEXTURE_2D,J.TEXTURE_MIN_FILTER,J.LINEAR),J.texParameteri(J.TEXTURE_2D,J.TEXTURE_MAG_FILTER,J.LINEAR),J.texImage2D(J.TEXTURE_2D,0,J.RGBA,1,1,0,J.RGBA,J.UNSIGNED_BYTE,new Uint8Array([0,0,0,0])),j},gQ=(J)=>{let j=J.getContext("webgl2",{premultipliedAlpha:!0});if(!j)throw Error("Failed to create WebGL2 context");let Q=lQ(j),$=QJ(j),Z=QJ(j),H=j.createVertexArray();j.bindVertexArray(H);let Y=j.createBuffer();j.bindBuffer(j.ARRAY_BUFFER,Y),j.bufferData(j.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),j.STATIC_DRAW);let K=j.getAttribLocation(Q,"a_pos");j.enableVertexAttribArray(K),j.vertexAttribPointer(K,2,j.FLOAT,!1,0,0);let W=j.getUniformLocation(Q,"u_time"),X=j.getUniformLocation(Q,"u_prev"),G=j.getUniformLocation(Q,"u_next"),D=j.getUniformLocation(Q,"u_seed");return{clear:()=>{j.clearColor(0,0,0,0),j.clear(j.COLOR_BUFFER_BIT)},cleanup:()=>{j.deleteProgram(Q),j.deleteTexture($),j.deleteTexture(Z)},draw:({prevImage:V,nextImage:q,width:N,height:B,time:z,passedProps:A})=>{let{seed:U=pQ}=A;if(!V&&!q)return;if(V&&(V.width===0||V.height===0))return;if(q&&(q.width===0||q.height===0))return;let O=!V?0:!q?1:z;if(j.viewport(0,0,N,B),j.clearColor(0,0,0,0),j.clear(j.COLOR_BUFFER_BIT),j.useProgram(Q),j.activeTexture(j.TEXTURE0),j.bindTexture(j.TEXTURE_2D,$),V)j.texElementImage2D(j.TEXTURE_2D,0,j.RGBA,j.RGBA,j.UNSIGNED_BYTE,V);if(j.uniform1i(X,0),j.activeTexture(j.TEXTURE1),j.bindTexture(j.TEXTURE_2D,Z),q)j.texElementImage2D(j.TEXTURE_2D,0,j.RGBA,j.RGBA,j.UNSIGNED_BYTE,q);j.uniform1i(G,1),j.uniform1f(W,O),j.uniform1f(D,U),j.drawArrays(j.TRIANGLE_STRIP,0,4)}}},nQ=Jj(gQ),rQ=`#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
	v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
	gl_Position = vec4(a_pos, 0.0, 1.0);
}`,tQ=`#version 300 es
precision highp float;

uniform sampler2D u_prev;
uniform sampler2D u_next;
uniform float u_time;
uniform float u_intensity;

in vec2 v_uv;
out vec4 outColor;

const int PASSES = 20;

vec4 transition(vec2 uv, float progress) {
	vec4 c1 = vec4(0.0);
	vec4 c2 = vec4(0.0);

	float disp = u_intensity * (0.5 - distance(0.5, progress));
	for (int xi = 0; xi < PASSES; xi++) {
		float x = float(xi) / float(PASSES) - 0.5;
		for (int yi = 0; yi < PASSES; yi++) {
			float y = float(yi) / float(PASSES) - 0.5;
			vec2 v = vec2(x, y);
			c1 += texture(u_prev, uv + disp * v);
			c2 += texture(u_next, uv + disp * v);
		}
	}

	c1 /= float(PASSES * PASSES);
	c2 /= float(PASSES * PASSES);
	return mix(c1, c2, progress);
}

void main() {
	float progress = 1.0 - u_time;
	outColor = transition(v_uv, progress);
}`,$J=(J,j,Q)=>{let $=J.createShader(Q);if(!$)throw Error("Failed to create shader");if(J.shaderSource($,j),J.compileShader($),!J.getShaderParameter($,J.COMPILE_STATUS)){let Z=J.getShaderInfoLog($);throw J.deleteShader($),Error(`Failed to compile shader: ${Z}`)}return $},aQ=(J)=>{let j=J.createProgram();if(!j)throw Error("Failed to create WebGL program");let Q=$J(J,rQ,J.VERTEX_SHADER),$=$J(J,tQ,J.FRAGMENT_SHADER);if(J.attachShader(j,Q),J.attachShader(j,$),J.linkProgram(j),!J.getProgramParameter(j,J.LINK_STATUS)){let Z=J.getProgramInfoLog(j);throw J.deleteProgram(j),Error(`Failed to link program: ${Z}`)}return j},ZJ=(J)=>{let j=J.createTexture();if(!j)throw Error("Failed to create texture");return J.bindTexture(J.TEXTURE_2D,j),J.texParameteri(J.TEXTURE_2D,J.TEXTURE_WRAP_S,J.CLAMP_TO_EDGE),J.texParameteri(J.TEXTURE_2D,J.TEXTURE_WRAP_T,J.CLAMP_TO_EDGE),J.texParameteri(J.TEXTURE_2D,J.TEXTURE_MIN_FILTER,J.LINEAR),J.texParameteri(J.TEXTURE_2D,J.TEXTURE_MAG_FILTER,J.LINEAR),J.texImage2D(J.TEXTURE_2D,0,J.RGBA,1,1,0,J.RGBA,J.UNSIGNED_BYTE,new Uint8Array([0,0,0,0])),j},eQ=(J)=>{let j=J.getContext("webgl2",{premultipliedAlpha:!0});if(!j)throw Error("Failed to create WebGL2 context");let Q=aQ(j),$=ZJ(j),Z=ZJ(j),H=j.createVertexArray();j.bindVertexArray(H);let Y=j.createBuffer();j.bindBuffer(j.ARRAY_BUFFER,Y),j.bufferData(j.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),j.STATIC_DRAW);let K=j.getAttribLocation(Q,"a_pos");j.enableVertexAttribArray(K),j.vertexAttribPointer(K,2,j.FLOAT,!1,0,0);let W=j.getUniformLocation(Q,"u_time"),X=j.getUniformLocation(Q,"u_prev"),G=j.getUniformLocation(Q,"u_next"),D=j.getUniformLocation(Q,"u_intensity");return{clear:()=>{j.clearColor(0,0,0,0),j.clear(j.COLOR_BUFFER_BIT)},cleanup:()=>{j.deleteProgram(Q),j.deleteTexture($),j.deleteTexture(Z)},draw:({prevImage:V,nextImage:q,width:N,height:B,time:z,passedProps:A})=>{let{intensity:U=0.1}=A;if(!V&&!q)return;if(V&&(V.width===0||V.height===0))return;if(q&&(q.width===0||q.height===0))return;let O=!V?0:!q?1:z;if(j.viewport(0,0,N,B),j.clearColor(0,0,0,0),j.clear(j.COLOR_BUFFER_BIT),j.useProgram(Q),j.activeTexture(j.TEXTURE0),j.bindTexture(j.TEXTURE_2D,$),V)j.texElementImage2D(j.TEXTURE_2D,0,j.RGBA,j.RGBA,j.UNSIGNED_BYTE,V);if(j.uniform1i(X,0),j.activeTexture(j.TEXTURE1),j.bindTexture(j.TEXTURE_2D,Z),q)j.texElementImage2D(j.TEXTURE_2D,0,j.RGBA,j.RGBA,j.UNSIGNED_BYTE,q);j.uniform1i(G,1),j.uniform1f(W,O),j.uniform1f(D,U),j.drawArrays(j.TRIANGLE_STRIP,0,4)}}},j0=Jj(eQ),Q0=(J)=>{return{getDurationInFrames:()=>{return J.durationInFrames},getProgress:({frame:j})=>{return J0(j,[0,J.durationInFrames],[0,1],{easing:J.easing,extrapolateLeft:"clamp",extrapolateRight:"clamp"})}}},H0=(J={})=>{return{getDurationInFrames:({fps:j})=>{if(J.durationInFrames)return J.durationInFrames;return $0({config:J.config,threshold:J.durationRestThreshold,fps:j})},getProgress:({fps:j,frame:Q})=>{let $=J.reverse?0:1,Z=J.reverse?1:0;return Z0({fps:j,frame:Q,to:$,from:Z,config:J.config,durationInFrames:J.durationInFrames,durationRestThreshold:J.durationRestThreshold,reverse:J.reverse})}}},VJ=DJ.createContext(null),qJ=DJ.createContext(null),WJ=({presentationProgress:J,children:j})=>{let Q=_J(()=>{return{enteringProgress:J}},[J]);return UJ(VJ.Provider,{value:Q,children:j})},YJ=({presentationProgress:J,children:j})=>{let Q=_J(()=>{return{exitingProgress:J}},[J]);return UJ(qJ.Provider,{value:Q,children:j})},AJ=(J)=>{return XJ.Children.toArray(J).reduce((Q,$)=>{if($.type===XJ.Fragment)return Q.concat(AJ($.props.children));return Q.push($),Q},[])},GJ=Dj.validateDurationInFrames,{SequenceWithoutSchema:jj}=d,l=function(J){return null},Cj=()=>{return null},TJ=({children:J})=>{return b(NJ,{children:J})},B0={name:d.sequenceSchema.name,hidden:d.sequenceSchema.hidden,showInTimeline:d.sequenceSchema.showInTimeline,from:d.fromField,freeze:d.freezeField,layout:d.sequenceSchema.layout},D0=({children:J})=>{let{fps:j}=G0(),Q=X0(),$=KJ({}),Z=KJ({}),H=HJ(()=>{return AJ(J)},[J]),Y=Oj((G)=>{let D=$?.current?.[G],_=Z?.current?.[G];if(!_?.elementImage&&D?.elementImage){_?.draw?.(null,null,0),D?.draw?.(D?.elementImage??null,null,0);return}if(!D?.elementImage&&_?.elementImage){D?.draw?.(null,null,0),_?.draw?.(null,_?.elementImage??null,0);return}if(D&&_&&D.progress===_.progress||!D?.elementImage||!_?.elementImage)D?.draw?.(D?.elementImage??null,_?.elementImage??null,D?.progress??_?.progress??0),_?.draw?.(null,null,0)},[]),K=Oj((G,D,_,T)=>{$.current[T]={elementImage:G,progress:D,draw:_},Y(T)},[Y]),W=Oj((G,D,_,T)=>{Z.current[T]={elementImage:G,progress:D,draw:_},Y(T)},[Y]),X=HJ(()=>{let G=0,D=0,_=[],T=[],E=!1,V=K0.map(H,(N,B)=>{let z=N;if(typeof z==="string"){if(z.trim()==="")return null;throw TypeError(`The <TransitionSeries /> component only accepts a list of <TransitionSeries.Sequence /> components as its children, but you passed a string "${z}"`)}let A=H[B-1],U=H[B+1],O=typeof A==="string"||typeof A>"u"?!1:A.type===l,w=typeof A==="string"||typeof A>"u"?!1:A.type===Cj;if(z.type===Cj){if(w)throw TypeError(`A <TransitionSeries.Overlay /> component must not be followed by another <TransitionSeries.Overlay /> component (nth children = ${B-1} and ${B})`);if(O)throw TypeError(`A <TransitionSeries.Transition /> component must not be followed by a <TransitionSeries.Overlay /> component (nth children = ${B-1} and ${B})`);if(typeof U==="string"||typeof U>"u"?!1:U.type===l)throw TypeError(`A <TransitionSeries.Overlay /> component must not be followed by a <TransitionSeries.Transition /> component (nth children = ${B} and ${B+1})`);let C=z.props;GJ(C.durationInFrames,{component:"of a <TransitionSeries.Overlay /> component",allowFloats:!1});let k=C.offset??0;if(Number.isNaN(k))throw TypeError('The "offset" property of a <TransitionSeries.Overlay /> must not be NaN, but got NaN.');if(!Number.isFinite(k))throw TypeError(`The "offset" property of a <TransitionSeries.Overlay /> must be finite, but got ${k}.`);if(k%1!==0)throw TypeError(`The "offset" property of a <TransitionSeries.Overlay /> must be an integer, but got ${k}.`);let h=D+G,u=C.durationInFrames/2,m=h-u+k;if(m<0)throw TypeError(`A <TransitionSeries.Overlay /> extends before frame 0. The overlay starts at frame ${m}. Reduce the duration or adjust the offset.`);let Vj=T.length-1;if(Vj>=0){let kj=u-k;if(kj>T[Vj])throw TypeError(`A <TransitionSeries.Overlay /> extends beyond the previous sequence. The overlay needs ${kj} frames before the cut, but the previous sequence is only ${T[Vj]} frames long.`)}return E=!0,_.push({cutPoint:h,overlayFrom:m,durationInFrames:C.durationInFrames,overlayOffset:k,halfDuration:u,children:C.children,index:B}),null}if(z.type===l){if(O)throw TypeError(`A <TransitionSeries.Transition /> component must not be followed by another <TransitionSeries.Transition /> component (nth children = ${B-1} and ${B})`);if(w)throw TypeError(`A <TransitionSeries.Overlay /> component must not be followed by a <TransitionSeries.Transition /> component (nth children = ${B-1} and ${B})`);return null}if(z.type!==TJ)throw TypeError(`The <TransitionSeries /> component only accepts a list of <TransitionSeries.Sequence />, <TransitionSeries.Transition />, and <TransitionSeries.Overlay /> components as its children, but got ${z} instead`);let M=typeof A==="string"||typeof A>"u"?null:A.type===l?A:null,L=typeof U==="string"||typeof U>"u"?null:U.type===l?U:null,x=z,g=`index = ${B}, duration = ${x.props.durationInFrames}`,S=x.props.durationInFrames,{durationInFrames:zJ,children:V0,from:q0,...F}=x.props;GJ(S,{component:"of a <TransitionSeries.Sequence /> component",allowFloats:!0});let c=x.props.offset??0;if(Number.isNaN(c))throw TypeError(`The "offset" property of a <TransitionSeries.Sequence /> must not be NaN, but got NaN (${g}).`);if(!Number.isFinite(c))throw TypeError(`The "offset" property of a <TransitionSeries.Sequence /> must be finite, but got ${c} (${g}).`);if(c%1!==0)throw TypeError(`The "offset" property of a <TransitionSeries.Sequence /> must be finite, but got ${c} (${g}).`);let MJ=D+c,Ej=0;if(M)Ej=M.props.timing.getDurationInFrames({fps:j}),G-=Ej;let I=MJ+G;if(D+=S+c,I<0)D-=I,I=0;if(T.push(S),E){E=!1;let y=_[_.length-1],C=y.halfDuration+y.overlayOffset;if(C>S)throw TypeError(`A <TransitionSeries.Overlay /> extends beyond the next sequence. The overlay needs ${C} frames after the cut, but the next sequence is only ${S} frames long.`)}let f=L?L.props.timing.getProgress({frame:Q-I-zJ+L.props.timing.getDurationInFrames({fps:j}),fps:j}):null,v=M?M.props.timing.getProgress({frame:Q-I,fps:j}):null;if(L&&S<L.props.timing.getDurationInFrames({fps:j}))throw Error(`The duration of a <TransitionSeries.Sequence /> must not be shorter than the duration of the next <TransitionSeries.Transition />. The transition is ${L.props.timing.getDurationInFrames({fps:j})} frames long, but the sequence is only ${S} frames long (${g})`);if(M&&S<M.props.timing.getDurationInFrames({fps:j}))throw Error(`The duration of a <TransitionSeries.Sequence /> must not be shorter than the duration of the previous <TransitionSeries.Transition />. The transition is ${M.props.timing.getDurationInFrames({fps:j})} frames long, but the sequence is only ${S} frames long (${g})`);if(L&&M&&f!==null&&v!==null){let y=L.props.presentation??_j(),C=M.props.presentation??_j(),k=y.component,h=C.component;return b(jj,{from:I,durationInFrames:S,...F,name:F.name||"<TS.Sequence>",_remotionInternalDocumentationLink:F.name?void 0:"https://www.remotion.dev/docs/transitions/transitionseries",children:b(k,{passedProps:y.props??{},presentationDirection:"exiting",presentationProgress:f,presentationDurationInFrames:L.props.timing.getDurationInFrames({fps:j}),onElementImage:()=>{throw Error("Should not call when exiting")},onUnmount:()=>{throw Error("Should not call when exiting")},bothEnteringAndExiting:!0,children:b(YJ,{presentationProgress:f,children:b(h,{passedProps:C.props??{},presentationDirection:"entering",presentationProgress:v,presentationDurationInFrames:M.props.timing.getDurationInFrames({fps:j}),onElementImage:(u,m)=>{W(u,f,m,B+1),K(u,v,m,B-1)},onUnmount:()=>{W(null,null,null,B+1),K(null,null,null,B-1)},bothEnteringAndExiting:!0,children:b(WJ,{presentationProgress:v,children:N})})})})},B)}if(v!==null&&M){let y=M.props.presentation??_j(),C=y.component;return b(jj,{from:I,durationInFrames:S,...F,name:F.name||"<TS.Sequence>",_remotionInternalDocumentationLink:F.name?void 0:"https://www.remotion.dev/docs/transitions/transitionseries",children:b(C,{passedProps:y.props??{},presentationDirection:"entering",presentationProgress:v,presentationDurationInFrames:M.props.timing.getDurationInFrames({fps:j}),onElementImage:(k,h)=>K(k,v,h,B-1),onUnmount:()=>{K(null,null,null,B-1)},bothEnteringAndExiting:!1,children:b(WJ,{presentationProgress:v,children:N})})},B)}if(f!==null&&L){let y=L.props.presentation??_j(),C=y.component;return b(jj,{from:I,durationInFrames:S,...F,name:F.name||"<TS.Sequence>",_remotionInternalDocumentationLink:F.name?void 0:"https://www.remotion.dev/docs/transitions/transitionseries",children:b(C,{passedProps:y.props??{},presentationDirection:"exiting",presentationProgress:f,presentationDurationInFrames:L.props.timing.getDurationInFrames({fps:j}),onElementImage:(k,h)=>W(k,f,h,B+1),onUnmount:()=>{W(null,null,null,B+1)},bothEnteringAndExiting:!1,children:b(YJ,{presentationProgress:f,children:N})})},B)}return b(jj,{from:I,durationInFrames:S,...F,name:F.name||"<TS.Sequence>",_remotionInternalDocumentationLink:F.name?void 0:"https://www.remotion.dev/docs/transitions/transitionseries",children:N},B)}),q=_.map((N)=>{let B=N;return b(jj,{from:Math.round(B.overlayFrom),durationInFrames:B.durationInFrames,name:"<TS.Overlay>",_remotionInternalDocumentationLink:"https://www.remotion.dev/docs/transitions/transitionseries",layout:"absolute-fill",children:B.children},`overlay-${B.index}`)});return[...V||[],...q]},[H,j,Q,W,K]);return b(NJ,{children:X})},_0=(J)=>{let{children:j,name:Q,layout:$,controls:Z,...H}=J,{stack:Y,...K}=H,W=Q??"<TransitionSeries>",X=$??"absolute-fill";if(Dj.ENABLE_V5_BREAKING_CHANGES&&X!=="absolute-fill")throw TypeError(`The "layout" prop of <TransitionSeries /> is not supported anymore in v5. TransitionSeries' must be absolutely positioned.`);return b(Y0,{name:W,layout:X,_remotionInternalDocumentationLink:Q===void 0?"https://www.remotion.dev/docs/transitions/transitionseries":void 0,...K,_remotionInternalStack:Y??void 0,controls:Z??void 0,children:b(D0,{children:j})})},Qj=W0.withSchema({Component:_0,componentName:"<TransitionSeries>",componentIdentity:"dev.remotion.transitions.TransitionSeries",schema:B0,supportsEffects:!1});Qj.Sequence=TJ;Qj.Transition=l;Qj.Overlay=Cj;d.addSequenceStackTraces(Qj);var U0=()=>{let J=BJ.useContext(VJ),j=BJ.useContext(qJ);if(!J&&!j)return{isInTransitionSeries:!1,entering:1,exiting:0};return{isInTransitionSeries:!0,entering:J?.enteringProgress??1,exiting:j?.exitingProgress??0}};var{TransitionSeries:h0,crossZoom:d0,dreamyZoom:c0,filmBurn:u0,linearBlur:m0,linearTiming:i0,makeHtmlInCanvasPresentation:p0,springTiming:s0,useTransitionProgress:o0}=Uj;var g0=Uj;export{o0 as useTransitionProgress,s0 as springTiming,p0 as makeHtmlInCanvasPresentation,i0 as linearTiming,m0 as linearBlur,u0 as filmBurn,c0 as dreamyZoom,g0 as default,d0 as crossZoom,h0 as TransitionSeries};
