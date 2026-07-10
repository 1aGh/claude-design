var gE=Object.defineProperty;var oQ=(J,Q)=>{for(var X in Q)gE(J,X,{get:Q[X],enumerable:!0,configurable:!0,set:(Y)=>Q[X]=()=>Y})};var bH=(J,Q)=>()=>(J&&(Q=J(J=0)),Q);var n8=((J)=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(J,{get:(Q,X)=>(typeof require<"u"?require:Q)[X]}):J)(function(J){if(typeof require<"u")return require.apply(this,arguments);throw Error('Dynamic require of "'+J+'" is not supported')});var dV={};oQ(dV,{registerBackend:()=>k8,env:()=>a0,default:()=>WA,Tensor:()=>Y6,TRACE_FUNC_END:()=>m1,TRACE_FUNC_BEGIN:()=>H6,TRACE:()=>x2,InferenceSession:()=>H3});var X3,lE,mE,pE,cE,J0=(J,Q)=>()=>(J&&(Q=J(J=0)),Q),h2=(J,Q)=>{for(var X in Q)X3(J,X,{get:Q[X],enumerable:!0})},dE=(J,Q,X,Y)=>{if(Q&&typeof Q=="object"||typeof Q=="function")for(let H of mE(Q))!pE.call(J,H)&&H!==X&&X3(J,H,{get:()=>Q[H],enumerable:!(Y=lE(Q,H))||Y.enumerable});return J},h5=(J)=>dE(X3({},"__esModule",{value:!0}),J),z2,m6,k8,vH,Vj,Kj,uE,Mj,oE,sQ,l1,Bj,a0,sE,Lj,Uj,aE,z5,Oj,Rj,Ej,Dj,Aj,iE,S8,_2,aQ,zj,nE,$j,Pj,rE,T1,Y3,Y6,Sj,x2,iQ,H6,m1,Zj,wj,tE,H3,eE,JD,QD,XD,YD,kj,q6,q3,Cj,nQ,rQ,Ij,HD,_j,tQ,eQ,bj,TH,qD,JX,xH,v1,vj,$5,fH,hH,QX,yH,XX,Tj,YX,xj,W3,HX,P5,$2,qX,gH,lH,G3,F1,b8,D1,y5,m0,j3,fj,WD,mH,pH,cH,dH,hj,GD,t8,Z8,w8,F3,g5,N3,V3,pX,A0,K3,yj,uH,oH,sH,aH,M3,iH,x0,x6,B3,gj,L3,WX,S5,Z5,nH,rH,GX,cX,tH,lj,jD,eH,c0,J1,Jq,J7,d,l5,mj,pj,cj,Z0,Q7,w5,N1,$1,O0,t0,dX,e8,d6,L0,P2,a,M0,dj,U3,Qq,uj,C0,Xq,jX,Yq,Hq,qq,Wq,x1,oj,sj,u6,Gq,jq,Fq,Nq,Vq,Kq,Mq,Bq,Lq,Uq,t1,aj,ij,nj,rj,tj,ej,JF,QF,XF,YF,FD,e1,Oq,m5,uX,J6,Rq,Eq,Dq,Aq,zq,$q,Pq,Sq,Zq,wq,Q6,HF,qF,WF,GF,jF,FF,NF,VF,KF,MF,O3,FX,BF,LF,oX,ND,kq,k5,Cq,Iq,_q,f2,bq,UF,R3,vq,Tq,xq,OF,VD,fq,hq,RF,KD,yq,y0,EF,DF,AF,zF,$F,PF,SF,ZF,wF,gq,kF,CF,IF,_F,b2,bF,f5,vF,TF,xF,fF,hF,yF,gF,lF,mF,pF,cF,dF,uF,oF,sF,aF,NX,iF,sX,aX,nF,rF,tF,lq,mq,eF,E3,pq,cq,JN,MD,dq,uq,X6,QN,XN,YN,HN,qN,WN,GN,jN,FN,NN,BD,oq,sq,aq,iq,VN,KN,LD,C8,I8,_8,D3,v8,M1,MN,A3,BN,UD,T2,z3,$3,nq,rq,iX,VX,tq,nX,eq,p5,P3,JW,LN,OD,QW,KX,S2,XW,MX,YW,UN,ON,RD,RN,EN,ED,HW,C5,qW,I5,rX,BX,WW,GW,tX,DD,DN,AD,jW,FW,NW,LX,AN,VW,UX,KW,zN,zD,MW,$N,PN,$D,BW,LW,UW,SN,ZN,PD,_5,Z2,OX,OW,RW,EW,DW,RX,AW,wN,kN,SD,zW,EX,$W,PW,CN,ZD,SW,IN,wD,ZW,wW,_N,bN,kD,kW,vN,TN,CD,CW,IW,xN,fN,ID,_W,bW,hN,yN,_D,vW,TW,gN,lN,bD,U6,T6,A8,z8,xW,fW,hW,yW,gW,lW,mW,pW,mN,pN,vD,Z1,cW,cN,DX,dW,v2,dN,uN,uW,oW,sW,aW,eX,oN,sN,aN,iW,nW,AX,iN,TD,zX,rW,tW,nN,xD,eW,JG,rN,fD,QG,tN,hD,XG,YG,HG,eN,JV,yD,qG,WG,GG,jG,FG,NG,VG,KG,QV,gD,w2,$X,PX,SX,ZX,MG,BG,wX,kX,XV,YV,CX,HV,qV,IX,WV,GV,jV,FV,lD,LG,UG,NV,VV,mD,OG,RG,KV,pD,EG,DG,MV,BV,cD,AG,zG,$G,_X,PG,SG,ZG,wG,kG,CG,IG,_G,bX,bG,vG,TG,xG,fG,LV,UV,dD,hG,yG,OV,uD,gG,lG,RV,oD,mG,k2,pG,vX,cG,dG,EV,DV,sD,uG,oG,AV,zV,aD,TX,sG,aG,iG,$V,iD,nG,rG,PV,nD,SV,rD,ZV,tD,tG,eG,Jj,Qj,wV,eD,Xj,xX,Yj,fX,hX,yX,Hj,kV,JA,b5,qj,CV,QA,IV,v5,Wj,_V,XA,Gj,S3,Z3,p6,jj,c5,w3,k3,gX,C3,I3,_3,bV,c6,g1,r8,C2,I2,T5,lX,x5,$8,P8,Fj,vV,TV,xV,fV,hV,yV,gV,lV,mX,Nj,mV,YA,pV,J3,Q3,cV,HA,qA="1.21.0",WA;var uV=bH(()=>{/*!
 * ONNX Runtime Web v1.21.0
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */X3=Object.defineProperty,lE=Object.getOwnPropertyDescriptor,mE=Object.getOwnPropertyNames,pE=Object.prototype.hasOwnProperty,cE=((J)=>n8)(function(J){return n8.apply(this,arguments)}),Kj=J0(()=>{z2=new Map,m6=[],k8=(J,Q,X)=>{if(Q&&typeof Q.init=="function"&&typeof Q.createInferenceSessionHandler=="function"){let Y=z2.get(J);if(Y===void 0)z2.set(J,{backend:Q,priority:X});else{if(Y.priority>X)return;if(Y.priority===X&&Y.backend!==Q)throw Error(`cannot register backend "${J}" using priority ${X}`)}if(X>=0){let H=m6.indexOf(J);H!==-1&&m6.splice(H,1);for(let W=0;W<m6.length;W++)if(z2.get(m6[W]).priority<=X){m6.splice(W,0,J);return}m6.push(J)}return}throw TypeError("not a valid backend")},vH=async(J)=>{let Q=z2.get(J);if(!Q)return"backend not found.";if(Q.initialized)return Q.backend;if(Q.aborted)return Q.error;{let X=!!Q.initPromise;try{return X||(Q.initPromise=Q.backend.init(J)),await Q.initPromise,Q.initialized=!0,Q.backend}catch(Y){return X||(Q.error=`${Y}`,Q.aborted=!0),Q.error}finally{delete Q.initPromise}}},Vj=async(J)=>{let Q=J.executionProviders||[],X=Q.map((N)=>typeof N=="string"?N:N.name),Y=X.length===0?m6:X,H,W=[],G=new Set;for(let N of Y){let V=await vH(N);typeof V=="string"?W.push({name:N,err:V}):(H||(H=V),H===V&&G.add(N))}if(!H)throw Error(`no available backend found. ERR: ${W.map((N)=>`[${N.name}] ${N.err}`).join(", ")}`);for(let{name:N,err:V}of W)X.includes(N)&&console.warn(`removing requested execution provider "${N}" from session options because it is not available: ${V}`);let j=Q.filter((N)=>G.has(typeof N=="string"?N:N.name));return[H,new Proxy(J,{get:(N,V)=>V==="executionProviders"?j:Reflect.get(N,V)})]}}),uE=J0(()=>{Kj()}),oE=J0(()=>{Mj="1.21.0"}),Bj=J0(()=>{oE(),sQ="warning",l1={wasm:{},webgl:{},webgpu:{},versions:{common:Mj},set logLevel(J){if(J!==void 0){if(typeof J!="string"||["verbose","info","warning","error","fatal"].indexOf(J)===-1)throw Error(`Unsupported logging level: ${J}`);sQ=J}},get logLevel(){return sQ}},Object.defineProperty(l1,"logLevel",{enumerable:!0})}),sE=J0(()=>{Bj(),a0=l1}),aE=J0(()=>{Lj=(J,Q)=>{let X=typeof document<"u"?document.createElement("canvas"):new OffscreenCanvas(1,1);X.width=J.dims[3],X.height=J.dims[2];let Y=X.getContext("2d");if(Y!=null){let H,W;Q?.tensorLayout!==void 0&&Q.tensorLayout==="NHWC"?(H=J.dims[2],W=J.dims[3]):(H=J.dims[3],W=J.dims[2]);let G=Q?.format!==void 0?Q.format:"RGB",j=Q?.norm,N,V;j===void 0||j.mean===void 0?N=[255,255,255,255]:typeof j.mean=="number"?N=[j.mean,j.mean,j.mean,j.mean]:(N=[j.mean[0],j.mean[1],j.mean[2],0],j.mean[3]!==void 0&&(N[3]=j.mean[3])),j===void 0||j.bias===void 0?V=[0,0,0,0]:typeof j.bias=="number"?V=[j.bias,j.bias,j.bias,j.bias]:(V=[j.bias[0],j.bias[1],j.bias[2],0],j.bias[3]!==void 0&&(V[3]=j.bias[3]));let L=W*H,B=0,U=L,E=L*2,R=-1;G==="RGBA"?(B=0,U=L,E=L*2,R=L*3):G==="RGB"?(B=0,U=L,E=L*2):G==="RBG"&&(B=0,E=L,U=L*2);for(let A=0;A<W;A++)for(let P=0;P<H;P++){let z=(J.data[B++]-V[0])*N[0],D=(J.data[U++]-V[1])*N[1],S=(J.data[E++]-V[2])*N[2],w=R===-1?255:(J.data[R++]-V[3])*N[3];Y.fillStyle="rgba("+z+","+D+","+S+","+w+")",Y.fillRect(P,A,1,1)}if("toDataURL"in X)return X.toDataURL();throw Error("toDataURL is not supported")}else throw Error("Can not access image data")},Uj=(J,Q)=>{let X=typeof document<"u"?document.createElement("canvas").getContext("2d"):new OffscreenCanvas(1,1).getContext("2d"),Y;if(X!=null){let H,W,G;Q?.tensorLayout!==void 0&&Q.tensorLayout==="NHWC"?(H=J.dims[2],W=J.dims[1],G=J.dims[3]):(H=J.dims[3],W=J.dims[2],G=J.dims[1]);let j=Q!==void 0&&Q.format!==void 0?Q.format:"RGB",N=Q?.norm,V,L;N===void 0||N.mean===void 0?V=[255,255,255,255]:typeof N.mean=="number"?V=[N.mean,N.mean,N.mean,N.mean]:(V=[N.mean[0],N.mean[1],N.mean[2],255],N.mean[3]!==void 0&&(V[3]=N.mean[3])),N===void 0||N.bias===void 0?L=[0,0,0,0]:typeof N.bias=="number"?L=[N.bias,N.bias,N.bias,N.bias]:(L=[N.bias[0],N.bias[1],N.bias[2],0],N.bias[3]!==void 0&&(L[3]=N.bias[3]));let B=W*H;if(Q!==void 0&&(Q.format!==void 0&&G===4&&Q.format!=="RGBA"||G===3&&Q.format!=="RGB"&&Q.format!=="BGR"))throw Error("Tensor format doesn't match input tensor dims");let U=4,E=0,R=1,A=2,P=3,z=0,D=B,S=B*2,w=-1;j==="RGBA"?(z=0,D=B,S=B*2,w=B*3):j==="RGB"?(z=0,D=B,S=B*2):j==="RBG"&&(z=0,S=B,D=B*2),Y=X.createImageData(H,W);for(let k=0;k<W*H;E+=U,R+=U,A+=U,P+=U,k++)Y.data[E]=(J.data[z++]-L[0])*V[0],Y.data[R]=(J.data[D++]-L[1])*V[1],Y.data[A]=(J.data[S++]-L[2])*V[2],Y.data[P]=w===-1?255:(J.data[w++]-L[3])*V[3]}else throw Error("Can not access image data");return Y}}),iE=J0(()=>{Y3(),z5=(J,Q)=>{if(J===void 0)throw Error("Image buffer must be defined");if(Q.height===void 0||Q.width===void 0)throw Error("Image height and width must be defined");if(Q.tensorLayout==="NHWC")throw Error("NHWC Tensor layout is not supported yet");let{height:X,width:Y}=Q,H=Q.norm??{mean:255,bias:0},W,G;typeof H.mean=="number"?W=[H.mean,H.mean,H.mean,H.mean]:W=[H.mean[0],H.mean[1],H.mean[2],H.mean[3]??255],typeof H.bias=="number"?G=[H.bias,H.bias,H.bias,H.bias]:G=[H.bias[0],H.bias[1],H.bias[2],H.bias[3]??0];let j=Q.format!==void 0?Q.format:"RGBA",N=Q.tensorFormat!==void 0&&Q.tensorFormat!==void 0?Q.tensorFormat:"RGB",V=X*Y,L=N==="RGBA"?new Float32Array(V*4):new Float32Array(V*3),B=4,U=0,E=1,R=2,A=3,P=0,z=V,D=V*2,S=-1;j==="RGB"&&(B=3,U=0,E=1,R=2,A=-1),N==="RGBA"?S=V*3:N==="RBG"?(P=0,D=V,z=V*2):N==="BGR"&&(D=0,z=V,P=V*2);for(let w=0;w<V;w++,U+=B,R+=B,E+=B,A+=B)L[P++]=(J[U]+G[0])/W[0],L[z++]=(J[E]+G[1])/W[1],L[D++]=(J[R]+G[2])/W[2],S!==-1&&A!==-1&&(L[S++]=(J[A]+G[3])/W[3]);return N==="RGBA"?new T1("float32",L,[1,4,X,Y]):new T1("float32",L,[1,3,X,Y])},Oj=async(J,Q)=>{let X=typeof HTMLImageElement<"u"&&J instanceof HTMLImageElement,Y=typeof ImageData<"u"&&J instanceof ImageData,H=typeof ImageBitmap<"u"&&J instanceof ImageBitmap,W=typeof J=="string",G,j=Q??{},N=()=>{if(typeof document<"u")return document.createElement("canvas");if(typeof OffscreenCanvas<"u")return new OffscreenCanvas(1,1);throw Error("Canvas is not supported")},V=(L)=>typeof HTMLCanvasElement<"u"&&L instanceof HTMLCanvasElement||L instanceof OffscreenCanvas?L.getContext("2d"):null;if(X){let L=N();L.width=J.width,L.height=J.height;let B=V(L);if(B!=null){let{height:U,width:E}=J;if(Q!==void 0&&Q.resizedHeight!==void 0&&Q.resizedWidth!==void 0&&(U=Q.resizedHeight,E=Q.resizedWidth),Q!==void 0){if(j=Q,Q.tensorFormat!==void 0)throw Error("Image input config format must be RGBA for HTMLImageElement");j.tensorFormat="RGBA",j.height=U,j.width=E}else j.tensorFormat="RGBA",j.height=U,j.width=E;B.drawImage(J,0,0),G=B.getImageData(0,0,E,U).data}else throw Error("Can not access image data")}else if(Y){let L,B;if(Q!==void 0&&Q.resizedWidth!==void 0&&Q.resizedHeight!==void 0?(L=Q.resizedHeight,B=Q.resizedWidth):(L=J.height,B=J.width),Q!==void 0&&(j=Q),j.format="RGBA",j.height=L,j.width=B,Q!==void 0){let U=N();U.width=B,U.height=L;let E=V(U);if(E!=null)E.putImageData(J,0,0),G=E.getImageData(0,0,B,L).data;else throw Error("Can not access image data")}else G=J.data}else if(H){if(Q===void 0)throw Error("Please provide image config with format for Imagebitmap");let L=N();L.width=J.width,L.height=J.height;let B=V(L);if(B!=null){let{height:U,width:E}=J;return B.drawImage(J,0,0,E,U),G=B.getImageData(0,0,E,U).data,j.height=U,j.width=E,z5(G,j)}else throw Error("Can not access image data")}else{if(W)return new Promise((L,B)=>{let U=N(),E=V(U);if(!J||!E)return B();let R=new Image;R.crossOrigin="Anonymous",R.src=J,R.onload=()=>{U.width=R.width,U.height=R.height,E.drawImage(R,0,0,U.width,U.height);let A=E.getImageData(0,0,U.width,U.height);j.height=U.height,j.width=U.width,L(z5(A.data,j))}});throw Error("Input data provided is not supported - aborted tensor creation")}if(G!==void 0)return z5(G,j);throw Error("Input data provided is not supported - aborted tensor creation")},Rj=(J,Q)=>{let{width:X,height:Y,download:H,dispose:W}=Q;return new T1({location:"texture",type:"float32",texture:J,dims:[1,Y,X,4],download:H,dispose:W})},Ej=(J,Q)=>{let{dataType:X,dims:Y,download:H,dispose:W}=Q;return new T1({location:"gpu-buffer",type:X??"float32",gpuBuffer:J,dims:Y,download:H,dispose:W})},Dj=(J,Q)=>{let{dataType:X,dims:Y,download:H,dispose:W}=Q;return new T1({location:"ml-tensor",type:X??"float32",mlTensor:J,dims:Y,download:H,dispose:W})},Aj=(J,Q,X)=>new T1({location:"cpu-pinned",type:J,data:Q,dims:X??[Q.length]})}),nE=J0(()=>{S8=new Map([["float32",Float32Array],["uint8",Uint8Array],["int8",Int8Array],["uint16",Uint16Array],["int16",Int16Array],["int32",Int32Array],["bool",Uint8Array],["float64",Float64Array],["uint32",Uint32Array],["int4",Uint8Array],["uint4",Uint8Array]]),_2=new Map([[Float32Array,"float32"],[Uint8Array,"uint8"],[Int8Array,"int8"],[Uint16Array,"uint16"],[Int16Array,"int16"],[Int32Array,"int32"],[Float64Array,"float64"],[Uint32Array,"uint32"]]),aQ=!1,zj=()=>{if(!aQ){aQ=!0;let J=typeof BigInt64Array<"u"&&BigInt64Array.from,Q=typeof BigUint64Array<"u"&&BigUint64Array.from,X=globalThis.Float16Array,Y=typeof X<"u"&&X.from;J&&(S8.set("int64",BigInt64Array),_2.set(BigInt64Array,"int64")),Q&&(S8.set("uint64",BigUint64Array),_2.set(BigUint64Array,"uint64")),Y?(S8.set("float16",X),_2.set(X,"float16")):S8.set("float16",Uint16Array)}}}),rE=J0(()=>{Y3(),$j=(J)=>{let Q=1;for(let X=0;X<J.length;X++){let Y=J[X];if(typeof Y!="number"||!Number.isSafeInteger(Y))throw TypeError(`dims[${X}] must be an integer, got: ${Y}`);if(Y<0)throw RangeError(`dims[${X}] must be a non-negative integer, got: ${Y}`);Q*=Y}return Q},Pj=(J,Q)=>{switch(J.location){case"cpu":return new T1(J.type,J.data,Q);case"cpu-pinned":return new T1({location:"cpu-pinned",data:J.data,type:J.type,dims:Q});case"texture":return new T1({location:"texture",texture:J.texture,type:J.type,dims:Q});case"gpu-buffer":return new T1({location:"gpu-buffer",gpuBuffer:J.gpuBuffer,type:J.type,dims:Q});case"ml-tensor":return new T1({location:"ml-tensor",mlTensor:J.mlTensor,type:J.type,dims:Q});default:throw Error(`tensorReshape: tensor location ${J.location} is not supported`)}}}),Y3=J0(()=>{aE(),iE(),nE(),rE(),T1=class{constructor(J,Q,X){zj();let Y,H;if(typeof J=="object"&&"location"in J)switch(this.dataLocation=J.location,Y=J.type,H=J.dims,J.location){case"cpu-pinned":{let G=S8.get(Y);if(!G)throw TypeError(`unsupported type "${Y}" to create tensor from pinned buffer`);if(!(J.data instanceof G))throw TypeError(`buffer should be of type ${G.name}`);this.cpuData=J.data;break}case"texture":{if(Y!=="float32")throw TypeError(`unsupported type "${Y}" to create tensor from texture`);this.gpuTextureData=J.texture,this.downloader=J.download,this.disposer=J.dispose;break}case"gpu-buffer":{if(Y!=="float32"&&Y!=="float16"&&Y!=="int32"&&Y!=="int64"&&Y!=="uint32"&&Y!=="uint8"&&Y!=="bool"&&Y!=="uint4"&&Y!=="int4")throw TypeError(`unsupported type "${Y}" to create tensor from gpu buffer`);this.gpuBufferData=J.gpuBuffer,this.downloader=J.download,this.disposer=J.dispose;break}case"ml-tensor":{if(Y!=="float32"&&Y!=="float16"&&Y!=="int32"&&Y!=="int64"&&Y!=="uint32"&&Y!=="uint64"&&Y!=="int8"&&Y!=="uint8"&&Y!=="bool"&&Y!=="uint4"&&Y!=="int4")throw TypeError(`unsupported type "${Y}" to create tensor from MLTensor`);this.mlTensorData=J.mlTensor,this.downloader=J.download,this.disposer=J.dispose;break}default:throw Error(`Tensor constructor: unsupported location '${this.dataLocation}'`)}else{let G,j;if(typeof J=="string")if(Y=J,j=X,J==="string"){if(!Array.isArray(Q))throw TypeError("A string tensor's data must be a string array.");G=Q}else{let N=S8.get(J);if(N===void 0)throw TypeError(`Unsupported tensor type: ${J}.`);if(Array.isArray(Q)){if(J==="float16"&&N===Uint16Array||J==="uint4"||J==="int4")throw TypeError(`Creating a ${J} tensor from number array is not supported. Please use ${N.name} as data.`);J==="uint64"||J==="int64"?G=N.from(Q,BigInt):G=N.from(Q)}else if(Q instanceof N)G=Q;else if(Q instanceof Uint8ClampedArray)if(J==="uint8")G=Uint8Array.from(Q);else throw TypeError("A Uint8ClampedArray tensor's data must be type of uint8");else if(J==="float16"&&Q instanceof Uint16Array&&N!==Uint16Array)G=new globalThis.Float16Array(Q.buffer,Q.byteOffset,Q.length);else throw TypeError(`A ${Y} tensor's data must be type of ${N}`)}else if(j=Q,Array.isArray(J)){if(J.length===0)throw TypeError("Tensor type cannot be inferred from an empty array.");let N=typeof J[0];if(N==="string")Y="string",G=J;else if(N==="boolean")Y="bool",G=Uint8Array.from(J);else throw TypeError(`Invalid element type of data array: ${N}.`)}else if(J instanceof Uint8ClampedArray)Y="uint8",G=Uint8Array.from(J);else{let N=_2.get(J.constructor);if(N===void 0)throw TypeError(`Unsupported type for tensor data: ${J.constructor}.`);Y=N,G=J}if(j===void 0)j=[G.length];else if(!Array.isArray(j))throw TypeError("A tensor's dims must be a number array");H=j,this.cpuData=G,this.dataLocation="cpu"}let W=$j(H);if(this.cpuData&&W!==this.cpuData.length&&!((Y==="uint4"||Y==="int4")&&Math.ceil(W/2)===this.cpuData.length))throw Error(`Tensor's size(${W}) does not match data length(${this.cpuData.length}).`);this.type=Y,this.dims=H,this.size=W}static async fromImage(J,Q){return Oj(J,Q)}static fromTexture(J,Q){return Rj(J,Q)}static fromGpuBuffer(J,Q){return Ej(J,Q)}static fromMLTensor(J,Q){return Dj(J,Q)}static fromPinnedBuffer(J,Q,X){return Aj(J,Q,X)}toDataURL(J){return Lj(this,J)}toImageData(J){return Uj(this,J)}get data(){if(this.ensureValid(),!this.cpuData)throw Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");return this.cpuData}get location(){return this.dataLocation}get texture(){if(this.ensureValid(),!this.gpuTextureData)throw Error("The data is not stored as a WebGL texture.");return this.gpuTextureData}get gpuBuffer(){if(this.ensureValid(),!this.gpuBufferData)throw Error("The data is not stored as a WebGPU buffer.");return this.gpuBufferData}get mlTensor(){if(this.ensureValid(),!this.mlTensorData)throw Error("The data is not stored as a WebNN MLTensor.");return this.mlTensorData}async getData(J){switch(this.ensureValid(),this.dataLocation){case"cpu":case"cpu-pinned":return this.data;case"texture":case"gpu-buffer":case"ml-tensor":{if(!this.downloader)throw Error("The current tensor is not created with a specified data downloader.");if(this.isDownloading)throw Error("The current tensor is being downloaded.");try{this.isDownloading=!0;let Q=await this.downloader();return this.downloader=void 0,this.dataLocation="cpu",this.cpuData=Q,J&&this.disposer&&(this.disposer(),this.disposer=void 0),Q}finally{this.isDownloading=!1}}default:throw Error(`cannot get data from location: ${this.dataLocation}`)}}dispose(){if(this.isDownloading)throw Error("The current tensor is being downloaded.");this.disposer&&(this.disposer(),this.disposer=void 0),this.cpuData=void 0,this.gpuTextureData=void 0,this.gpuBufferData=void 0,this.mlTensorData=void 0,this.downloader=void 0,this.isDownloading=void 0,this.dataLocation="none"}ensureValid(){if(this.dataLocation==="none")throw Error("The tensor is disposed.")}reshape(J){if(this.ensureValid(),this.downloader||this.disposer)throw Error("Cannot reshape a tensor that owns GPU resource.");return Pj(this,J)}}}),Sj=J0(()=>{Y3(),Y6=T1}),Zj=J0(()=>{Bj(),x2=(J,Q)=>{(typeof l1.trace>"u"?!l1.wasm.trace:!l1.trace)||console.timeStamp(`${J}::ORT::${Q}`)},iQ=(J,Q)=>{let X=Error().stack?.split(/\r\n|\r|\n/g)||[],Y=!1;for(let H=0;H<X.length;H++){if(Y&&!X[H].includes("TRACE_FUNC")){let W=`FUNC_${J}::${X[H].trim().split(" ")[1]}`;Q&&(W+=`::${Q}`),x2("CPU",W);return}X[H].includes("TRACE_FUNC")&&(Y=!0)}},H6=(J)=>{(typeof l1.trace>"u"?!l1.wasm.trace:!l1.trace)||iQ("BEGIN",J)},m1=(J)=>{(typeof l1.trace>"u"?!l1.wasm.trace:!l1.trace)||iQ("END",J)}}),tE=J0(()=>{Kj(),Sj(),Zj(),wj=class J{constructor(Q){this.handler=Q}async run(Q,X,Y){H6();let H={},W={};if(typeof Q!="object"||Q===null||Q instanceof Y6||Array.isArray(Q))throw TypeError("'feeds' must be an object that use input names as keys and OnnxValue as corresponding values.");let G=!0;if(typeof X=="object"){if(X===null)throw TypeError("Unexpected argument[1]: cannot be null.");if(X instanceof Y6)throw TypeError("'fetches' cannot be a Tensor");if(Array.isArray(X)){if(X.length===0)throw TypeError("'fetches' cannot be an empty array.");G=!1;for(let V of X){if(typeof V!="string")throw TypeError("'fetches' must be a string array or an object.");if(this.outputNames.indexOf(V)===-1)throw RangeError(`'fetches' contains invalid output name: ${V}.`);H[V]=null}if(typeof Y=="object"&&Y!==null)W=Y;else if(typeof Y<"u")throw TypeError("'options' must be an object.")}else{let V=!1,L=Object.getOwnPropertyNames(X);for(let B of this.outputNames)if(L.indexOf(B)!==-1){let U=X[B];(U===null||U instanceof Y6)&&(V=!0,G=!1,H[B]=U)}if(V){if(typeof Y=="object"&&Y!==null)W=Y;else if(typeof Y<"u")throw TypeError("'options' must be an object.")}else W=X}}else if(typeof X<"u")throw TypeError("Unexpected argument[1]: must be 'fetches' or 'options'.");for(let V of this.inputNames)if(typeof Q[V]>"u")throw Error(`input '${V}' is missing in 'feeds'.`);if(G)for(let V of this.outputNames)H[V]=null;let j=await this.handler.run(Q,H,W),N={};for(let V in j)if(Object.hasOwnProperty.call(j,V)){let L=j[V];L instanceof Y6?N[V]=L:N[V]=new Y6(L.type,L.data,L.dims)}return m1(),N}async release(){return this.handler.dispose()}static async create(Q,X,Y,H){H6();let W,G={};if(typeof Q=="string"){if(W=Q,typeof X=="object"&&X!==null)G=X;else if(typeof X<"u")throw TypeError("'options' must be an object.")}else if(Q instanceof Uint8Array){if(W=Q,typeof X=="object"&&X!==null)G=X;else if(typeof X<"u")throw TypeError("'options' must be an object.")}else if(Q instanceof ArrayBuffer||typeof SharedArrayBuffer<"u"&&Q instanceof SharedArrayBuffer){let L=Q,B=0,U=Q.byteLength;if(typeof X=="object"&&X!==null)G=X;else if(typeof X=="number"){if(B=X,!Number.isSafeInteger(B))throw RangeError("'byteOffset' must be an integer.");if(B<0||B>=L.byteLength)throw RangeError(`'byteOffset' is out of range [0, ${L.byteLength}).`);if(U=Q.byteLength-B,typeof Y=="number"){if(U=Y,!Number.isSafeInteger(U))throw RangeError("'byteLength' must be an integer.");if(U<=0||B+U>L.byteLength)throw RangeError(`'byteLength' is out of range (0, ${L.byteLength-B}].`);if(typeof H=="object"&&H!==null)G=H;else if(typeof H<"u")throw TypeError("'options' must be an object.")}else if(typeof Y<"u")throw TypeError("'byteLength' must be a number.")}else if(typeof X<"u")throw TypeError("'options' must be an object.");W=new Uint8Array(L,B,U)}else throw TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");let[j,N]=await Vj(G),V=await j.createInferenceSessionHandler(W,N);return m1(),new J(V)}startProfiling(){this.handler.startProfiling()}endProfiling(){this.handler.endProfiling()}get inputNames(){return this.handler.inputNames}get outputNames(){return this.handler.outputNames}}}),eE=J0(()=>{tE(),H3=wj}),JD=J0(()=>{}),QD=J0(()=>{}),XD=J0(()=>{}),YD=J0(()=>{}),kj={};h2(kj,{InferenceSession:()=>H3,TRACE:()=>x2,TRACE_FUNC_BEGIN:()=>H6,TRACE_FUNC_END:()=>m1,Tensor:()=>Y6,env:()=>a0,registerBackend:()=>k8});q6=J0(()=>{uE(),sE(),eE(),Sj(),JD(),QD(),Zj(),XD(),YD()}),q3=J0(()=>{}),Cj={};h2(Cj,{default:()=>Ij});HD=J0(()=>{bV(),b8(),W3(),nQ="ort-wasm-proxy-worker",rQ=globalThis.self?.name===nQ,rQ&&(self.onmessage=(J)=>{let{type:Q,in:X}=J.data;try{switch(Q){case"init-wasm":G3(X.wasm).then(()=>{S3(X).then(()=>{postMessage({type:Q})},(Y)=>{postMessage({type:Q,err:Y})})},(Y)=>{postMessage({type:Q,err:Y})});break;case"init-ep":{let{epName:Y,env:H}=X;Z3(H,Y).then(()=>{postMessage({type:Q})},(W)=>{postMessage({type:Q,err:W})});break}case"copy-from":{let{buffer:Y}=X,H=c5(Y);postMessage({type:Q,out:H});break}case"create":{let{model:Y,options:H}=X;w3(Y,H).then((W)=>{postMessage({type:Q,out:W})},(W)=>{postMessage({type:Q,err:W})});break}case"release":k3(X),postMessage({type:Q});break;case"run":{let{sessionId:Y,inputIndices:H,inputs:W,outputIndices:G,options:j}=X;C3(Y,H,W,G,Array(G.length).fill(null),j).then((N)=>{N.some((V)=>V[3]!=="cpu")?postMessage({type:Q,err:"Proxy does not support non-cpu tensor location."}):postMessage({type:Q,out:N},_3([...W,...N]))},(N)=>{postMessage({type:Q,err:N})});break}case"end-profiling":I3(X),postMessage({type:Q});break;default:}}catch(Y){postMessage({type:Q,err:Y})}}),Ij=rQ?null:(J)=>new Worker(J??v1,{type:"module",name:nQ})}),_j={};h2(_j,{default:()=>bj});qD=J0(()=>{eQ=(tQ=import.meta.url,async function(J={}){var Q,X,Y=J,H=new Promise((q,F)=>{Q=q,X=F}),W=typeof window=="object",G=typeof WorkerGlobalScope<"u",j=G&&self.name?.startsWith("em-pthread");Y.mountExternalData=(q,F)=>{q.startsWith("./")&&(q=q.substring(2)),(Y.Bd||(Y.Bd=new Map)).set(q,F)},Y.unmountExternalData=()=>{delete Y.Bd};var N=globalThis.SharedArrayBuffer??new WebAssembly.Memory({initial:0,maximum:0,shared:!0}).buffer.constructor;let V=()=>{let q=(K,M,O)=>(...$)=>{let Z=Y1,_=M?.();$=K(...$);let b=M?.();return _!==b&&(K=b,O(_),M=O=null),Y1!=Z?new Promise((y,c)=>{M8={resolve:y,reject:c}}):$},F=(K)=>async(...M)=>{try{if(Y.Cd)throw Error("Session already started");let O=Y.Cd={be:M[0],errors:[]},$=await K(...M);if(Y.Cd!==O)throw Error("Session mismatch");Y.Dd?.flush();let Z=O.errors;if(0<Z.length){let _=await Promise.all(Z);if(_=_.filter((b)=>b),0<_.length)throw Error(_.join(`
`))}return $}finally{Y.Cd=null}};Y._OrtCreateSession=q(Y._OrtCreateSession,()=>Y._OrtCreateSession,(K)=>Y._OrtCreateSession=K),Y._OrtRun=F(q(Y._OrtRun,()=>Y._OrtRun,(K)=>Y._OrtRun=K)),Y._OrtRunWithBinding=F(q(Y._OrtRunWithBinding,()=>Y._OrtRunWithBinding,(K)=>Y._OrtRunWithBinding=K)),Y._OrtBindInput=q(Y._OrtBindInput,()=>Y._OrtBindInput,(K)=>Y._OrtBindInput=K),V=void 0};Y.jsepInit=(q,F)=>{if(V?.(),q==="webgpu"){[Y.Dd,Y.Rd,Y.Vd,Y.Hd,Y.Ud,Y.hc,Y.Wd,Y.Zd,Y.Sd,Y.Td,Y.Xd]=F;let K=Y.Dd;Y.jsepRegisterBuffer=(M,O,$,Z)=>K.registerBuffer(M,O,$,Z),Y.jsepGetBuffer=(M)=>K.getBuffer(M),Y.jsepCreateDownloader=(M,O,$)=>K.createDownloader(M,O,$),Y.jsepOnCreateSession=(M)=>{K.onCreateSession(M)},Y.jsepOnReleaseSession=(M)=>{K.onReleaseSession(M)},Y.jsepOnRunStart=(M)=>K.onRunStart(M),Y.$d=(M,O)=>{K.upload(M,O)}}else if(q==="webnn"){[Y.Dd,Y.Yd,Y.Id,Y.jsepEnsureTensor,Y.Jd,Y.jsepDownloadTensor]=F,Y.jsepReleaseTensorId=Y.Id,Y.jsepUploadTensor=Y.Jd;let K=Y.Dd;Y.jsepOnRunStart=(M)=>K.onRunStart(M),Y.jsepOnRunEnd=K.onRunEnd.bind(K),Y.jsepRegisterMLContext=(M,O)=>{K.registerMLContext(M,O)},Y.jsepOnReleaseSession=(M)=>{K.onReleaseSession(M)},Y.jsepCreateMLTensorDownloader=(M,O)=>K.createMLTensorDownloader(M,O),Y.jsepRegisterMLTensor=(M,O,$,Z)=>K.registerMLTensor(M,O,$,Z),Y.jsepCreateMLContext=(M)=>K.createMLContext(M),Y.jsepRegisterMLConstant=(M,O,$,Z,_)=>K.registerMLConstant(M,O,$,Z,_,Y.Bd),Y.jsepRegisterGraphInput=K.registerGraphInput.bind(K),Y.jsepIsGraphInput=K.isGraphInput.bind(K),Y.jsepCreateTemporaryTensor=K.createTemporaryTensor.bind(K)}};var L,B,U=Object.assign({},Y),E=(q,F)=>{throw F},R="";(W||G)&&(G?R=self.location.href:typeof document<"u"&&document.currentScript&&(R=document.currentScript.src),tQ&&(R=tQ),R=R.startsWith("blob:")?"":R.slice(0,R.replace(/[?#].*/,"").lastIndexOf("/")+1),G&&(B=(q)=>{var F=new XMLHttpRequest;return F.open("GET",q,!1),F.responseType="arraybuffer",F.send(null),new Uint8Array(F.response)}),L=async(q)=>{if(F0(q))return new Promise((K,M)=>{var O=new XMLHttpRequest;O.open("GET",q,!0),O.responseType="arraybuffer",O.onload=()=>{O.status==200||O.status==0&&O.response?K(O.response):M(O.status)},O.onerror=M,O.send(null)});var F=await fetch(q,{credentials:"same-origin"});if(F.ok)return F.arrayBuffer();throw Error(F.status+" : "+F.url)});var A=console.log.bind(console),P=console.error.bind(console),z=A,D=P;Object.assign(Y,U),U=null;var S,w,k,I,C,T,g,m,l,t,h,W0,j0,o=Y.wasmBinary,G0=!1,F0=(q)=>q.startsWith("file://");function s(){return S.buffer!=I.buffer&&u0(),I}function N0(){return S.buffer!=I.buffer&&u0(),C}function f(){return S.buffer!=I.buffer&&u0(),T}function p(){return S.buffer!=I.buffer&&u0(),g}function v(){return S.buffer!=I.buffer&&u0(),m}function r(){return S.buffer!=I.buffer&&u0(),l}function k0(){return S.buffer!=I.buffer&&u0(),t}function o0(){return S.buffer!=I.buffer&&u0(),j0}if(j){let q=function(F){try{var K=F.data,M=K.yd;if(M==="load"){let O=[];self.onmessage=($)=>O.push($),self.startWorker=()=>{postMessage({yd:"loaded"});for(let $ of O)q($);self.onmessage=q};for(let $ of K.Od)Y[$]&&!Y[$].proxy||(Y[$]=(...Z)=>{postMessage({yd:"callHandler",Nd:$,args:Z})},$=="print"&&(z=Y[$]),$=="printErr"&&(D=Y[$]));S=K.he,u0(),_0(K.ie)}else if(M==="run"){I4(K.xd),O8(K.xd,0,0,1,0,0),$7(),V8(K.xd),q1||(O9(),q1=!0);try{_4(K.de,K.Fd)}catch(O){if(O!="unwind")throw O}}else K.target!=="setimmediate"&&(M==="checkMailbox"?q1&&P6():M&&(D(`worker: received unknown command ${M}`),D(K)))}catch(O){throw R9(),O}};var h0=q,_0,q1=!1;D=function(...F){F=F.join(" "),console.error(F)},self.alert=function(...F){postMessage({yd:"alert",text:F.join(" "),fe:b6()})},self.onunhandledrejection=(F)=>{throw F.reason||F},self.onmessage=q}function u0(){var q=S.buffer;Y.HEAP8=I=new Int8Array(q),Y.HEAP16=T=new Int16Array(q),Y.HEAPU8=C=new Uint8Array(q),Y.HEAPU16=g=new Uint16Array(q),Y.HEAP32=m=new Int32Array(q),Y.HEAPU32=l=new Uint32Array(q),Y.HEAPF32=t=new Float32Array(q),Y.HEAPF64=j0=new Float64Array(q),Y.HEAP64=h=new BigInt64Array(q),Y.HEAPU64=W0=new BigUint64Array(q)}function D6(){j?startWorker(Y):x.Bb()}j||(S=new WebAssembly.Memory({initial:256,maximum:65536,shared:!0}),u0());var e6,o1=0,s1=null;function U7(){if(--o1==0&&s1){var q=s1;s1=null,q()}}function W1(q){throw D(q="Aborted("+q+")"),G0=!0,q=new WebAssembly.RuntimeError(q+". Build with -sASSERTIONS for more info."),X(q),q}function O7(){return{a:{Ta:C4,Va:k4,W:b4,la:v4,b:x4,u:f4,R:h4,Za:y4,d:g4,pb:w7,g:T4,T:I7,Ga:_7,lb:v7,nb:T7,Ha:x7,Ea:f7,wb:h7,Da:y7,pa:g7,mb:l7,jb:m7,Fa:p7,kb:c7,Ma:l4,za:p4,eb:c4,cb:u4,ya:s4,V:a4,N:i4,db:n4,ma:YJ,fb:HJ,zb:qJ,hb:WJ,qb:GJ,ab:jJ,Aa:FJ,yb:V8,Ja:NJ,S:VJ,Wa:KJ,$:LJ,G:UJ,E:RJ,m:j8,H:EJ,B:zJ,X:$J,J:PJ,v:SJ,O:ZJ,D:wJ,t:kJ,A:CJ,z:IJ,w:_J,r:bJ,tb:vJ,ub:TJ,vb:xJ,rb:Y9,sb:H9,bb:q9,Oa:hJ,La:lJ,y:mJ,ja:pJ,Ba:cJ,Ka:yJ,qa:dJ,Ia:uJ,ib:oJ,U:fJ,fa:sJ,Sa:aJ,gb:iJ,Qa:nJ,Pa:rJ,Ab:F9,Ca:N9,ob:Y8,aa:V9,oa:K9,xb:M9,na:B9,$a:PQ,ia:hQ,sa:pQ,ga:zQ,da:IQ,ua:lQ,p:DQ,e:HQ,c:XQ,ea:kQ,f:qQ,n:GQ,k:UQ,Y:FQ,ka:OQ,j:AQ,wa:wQ,Ra:uQ,ca:xQ,Ua:dQ,P:CQ,K:VQ,_:TQ,Q:$Q,Z:yQ,x:NQ,l:YQ,va:vQ,i:QQ,h:jQ,ra:cQ,ta:mQ,o:WQ,q:KQ,s:BQ,I:LQ,C:EQ,L:RQ,xa:ZQ,_a:SQ,F:fQ,Ya:_Q,ba:gQ,M:MQ,Xa:bQ,ha:eJ,a:S,Na:X8}}}var J8={1319426:()=>typeof wasmOffsetConverter<"u",1319483:(q,F,K,M,O)=>{if(Y===void 0||!Y.Bd)return 1;if((q=b0(Number(q>>>0))).startsWith("./")&&(q=q.substring(2)),!(q=Y.Bd.get(q)))return 2;if(F=Number(F>>>0),K=Number(K>>>0),M=Number(M>>>0),F+K>q.byteLength)return 3;try{let $=q.subarray(F,F+K);switch(O){case 0:N0().set($,M>>>0);break;case 1:Y.$d(M,$);break;default:return 4}return 0}catch{return 4}},1320198:(q,F,K)=>{Y.Jd(q,N0().subarray(F>>>0,F+K>>>0))},1320261:()=>Y.Yd(),1320302:(q)=>{Y.Id(q)},1320338:()=>{Y.Sd()},1320369:()=>{Y.Td()},1320398:()=>{Y.Xd()},1320423:(q)=>Y.Rd(q),1320456:(q)=>Y.Vd(q),1320488:(q,F,K)=>{Y.Hd(Number(q),Number(F),Number(K),!0)},1320551:(q,F,K)=>{Y.Hd(Number(q),Number(F),Number(K))},1320608:(q)=>{Y.hc("Abs",q,void 0)},1320659:(q)=>{Y.hc("Neg",q,void 0)},1320710:(q)=>{Y.hc("Floor",q,void 0)},1320763:(q)=>{Y.hc("Ceil",q,void 0)},1320815:(q)=>{Y.hc("Reciprocal",q,void 0)},1320873:(q)=>{Y.hc("Sqrt",q,void 0)},1320925:(q)=>{Y.hc("Exp",q,void 0)},1320976:(q)=>{Y.hc("Erf",q,void 0)},1321027:(q)=>{Y.hc("Sigmoid",q,void 0)},1321082:(q,F,K)=>{Y.hc("HardSigmoid",q,{alpha:F,beta:K})},1321161:(q)=>{Y.hc("Log",q,void 0)},1321212:(q)=>{Y.hc("Sin",q,void 0)},1321263:(q)=>{Y.hc("Cos",q,void 0)},1321314:(q)=>{Y.hc("Tan",q,void 0)},1321365:(q)=>{Y.hc("Asin",q,void 0)},1321417:(q)=>{Y.hc("Acos",q,void 0)},1321469:(q)=>{Y.hc("Atan",q,void 0)},1321521:(q)=>{Y.hc("Sinh",q,void 0)},1321573:(q)=>{Y.hc("Cosh",q,void 0)},1321625:(q)=>{Y.hc("Asinh",q,void 0)},1321678:(q)=>{Y.hc("Acosh",q,void 0)},1321731:(q)=>{Y.hc("Atanh",q,void 0)},1321784:(q)=>{Y.hc("Tanh",q,void 0)},1321836:(q)=>{Y.hc("Not",q,void 0)},1321887:(q,F,K)=>{Y.hc("Clip",q,{min:F,max:K})},1321956:(q)=>{Y.hc("Clip",q,void 0)},1322008:(q,F)=>{Y.hc("Elu",q,{alpha:F})},1322066:(q)=>{Y.hc("Gelu",q,void 0)},1322118:(q)=>{Y.hc("Relu",q,void 0)},1322170:(q,F)=>{Y.hc("LeakyRelu",q,{alpha:F})},1322234:(q,F)=>{Y.hc("ThresholdedRelu",q,{alpha:F})},1322304:(q,F)=>{Y.hc("Cast",q,{to:F})},1322362:(q)=>{Y.hc("Add",q,void 0)},1322413:(q)=>{Y.hc("Sub",q,void 0)},1322464:(q)=>{Y.hc("Mul",q,void 0)},1322515:(q)=>{Y.hc("Div",q,void 0)},1322566:(q)=>{Y.hc("Pow",q,void 0)},1322617:(q)=>{Y.hc("Equal",q,void 0)},1322670:(q)=>{Y.hc("Greater",q,void 0)},1322725:(q)=>{Y.hc("GreaterOrEqual",q,void 0)},1322787:(q)=>{Y.hc("Less",q,void 0)},1322839:(q)=>{Y.hc("LessOrEqual",q,void 0)},1322898:(q,F,K,M,O)=>{Y.hc("ReduceMean",q,{keepDims:!!F,noopWithEmptyAxes:!!K,axes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1323073:(q,F,K,M,O)=>{Y.hc("ReduceMax",q,{keepDims:!!F,noopWithEmptyAxes:!!K,axes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1323247:(q,F,K,M,O)=>{Y.hc("ReduceMin",q,{keepDims:!!F,noopWithEmptyAxes:!!K,axes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1323421:(q,F,K,M,O)=>{Y.hc("ReduceProd",q,{keepDims:!!F,noopWithEmptyAxes:!!K,axes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1323596:(q,F,K,M,O)=>{Y.hc("ReduceSum",q,{keepDims:!!F,noopWithEmptyAxes:!!K,axes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1323770:(q,F,K,M,O)=>{Y.hc("ReduceL1",q,{keepDims:!!F,noopWithEmptyAxes:!!K,axes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1323943:(q,F,K,M,O)=>{Y.hc("ReduceL2",q,{keepDims:!!F,noopWithEmptyAxes:!!K,axes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1324116:(q,F,K,M,O)=>{Y.hc("ReduceLogSum",q,{keepDims:!!F,noopWithEmptyAxes:!!K,axes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1324293:(q,F,K,M,O)=>{Y.hc("ReduceSumSquare",q,{keepDims:!!F,noopWithEmptyAxes:!!K,axes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1324473:(q,F,K,M,O)=>{Y.hc("ReduceLogSumExp",q,{keepDims:!!F,noopWithEmptyAxes:!!K,axes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1324653:(q)=>{Y.hc("Where",q,void 0)},1324706:(q,F,K)=>{Y.hc("Transpose",q,{perm:F?Array.from(v().subarray(Number(F)>>>0,Number(K)>>>0)):[]})},1324830:(q,F,K,M)=>{Y.hc("DepthToSpace",q,{blocksize:F,mode:b0(K),format:M?"NHWC":"NCHW"})},1324963:(q,F,K,M)=>{Y.hc("DepthToSpace",q,{blocksize:F,mode:b0(K),format:M?"NHWC":"NCHW"})},1325096:(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0,r0)=>{Y.hc("ConvTranspose",q,{format:b?"NHWC":"NCHW",autoPad:F,dilations:[K],group:M,kernelShape:[O],pads:[$,Z],strides:[_],wIsConst:()=>!!s()[y>>>0],outputPadding:c?Array.from(v().subarray(Number(c)>>>0,Number(n)>>>0)):[],outputShape:H0?Array.from(v().subarray(Number(H0)>>>0,Number(D0)>>>0)):[],activation:b0(r0)})},1325529:(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0)=>{Y.hc("ConvTranspose",q,{format:_?"NHWC":"NCHW",autoPad:F,dilations:Array.from(v().subarray(Number(K)>>>0,2+(Number(K)>>>0)>>>0)),group:M,kernelShape:Array.from(v().subarray(Number(O)>>>0,2+(Number(O)>>>0)>>>0)),pads:Array.from(v().subarray(Number($)>>>0,4+(Number($)>>>0)>>>0)),strides:Array.from(v().subarray(Number(Z)>>>0,2+(Number(Z)>>>0)>>>0)),wIsConst:()=>!!s()[b>>>0],outputPadding:y?Array.from(v().subarray(Number(y)>>>0,Number(c)>>>0)):[],outputShape:n?Array.from(v().subarray(Number(n)>>>0,Number(H0)>>>0)):[],activation:b0(D0)})},1326190:(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0,r0)=>{Y.hc("ConvTranspose",q,{format:b?"NHWC":"NCHW",autoPad:F,dilations:[K],group:M,kernelShape:[O],pads:[$,Z],strides:[_],wIsConst:()=>!!s()[y>>>0],outputPadding:c?Array.from(v().subarray(Number(c)>>>0,Number(n)>>>0)):[],outputShape:H0?Array.from(v().subarray(Number(H0)>>>0,Number(D0)>>>0)):[],activation:b0(r0)})},1326623:(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0)=>{Y.hc("ConvTranspose",q,{format:_?"NHWC":"NCHW",autoPad:F,dilations:Array.from(v().subarray(Number(K)>>>0,2+(Number(K)>>>0)>>>0)),group:M,kernelShape:Array.from(v().subarray(Number(O)>>>0,2+(Number(O)>>>0)>>>0)),pads:Array.from(v().subarray(Number($)>>>0,4+(Number($)>>>0)>>>0)),strides:Array.from(v().subarray(Number(Z)>>>0,2+(Number(Z)>>>0)>>>0)),wIsConst:()=>!!s()[b>>>0],outputPadding:y?Array.from(v().subarray(Number(y)>>>0,Number(c)>>>0)):[],outputShape:n?Array.from(v().subarray(Number(n)>>>0,Number(H0)>>>0)):[],activation:b0(D0)})},1327284:(q,F)=>{Y.hc("GlobalAveragePool",q,{format:F?"NHWC":"NCHW"})},1327375:(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0)=>{Y.hc("AveragePool",q,{format:D0?"NHWC":"NCHW",auto_pad:F,ceil_mode:K,count_include_pad:M,storage_order:O,dilations:$?Array.from(v().subarray(Number($)>>>0,Number(Z)>>>0)):[],kernel_shape:_?Array.from(v().subarray(Number(_)>>>0,Number(b)>>>0)):[],pads:y?Array.from(v().subarray(Number(y)>>>0,Number(c)>>>0)):[],strides:n?Array.from(v().subarray(Number(n)>>>0,Number(H0)>>>0)):[]})},1327854:(q,F)=>{Y.hc("GlobalAveragePool",q,{format:F?"NHWC":"NCHW"})},1327945:(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0)=>{Y.hc("AveragePool",q,{format:D0?"NHWC":"NCHW",auto_pad:F,ceil_mode:K,count_include_pad:M,storage_order:O,dilations:$?Array.from(v().subarray(Number($)>>>0,Number(Z)>>>0)):[],kernel_shape:_?Array.from(v().subarray(Number(_)>>>0,Number(b)>>>0)):[],pads:y?Array.from(v().subarray(Number(y)>>>0,Number(c)>>>0)):[],strides:n?Array.from(v().subarray(Number(n)>>>0,Number(H0)>>>0)):[]})},1328424:(q,F)=>{Y.hc("GlobalMaxPool",q,{format:F?"NHWC":"NCHW"})},1328511:(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0)=>{Y.hc("MaxPool",q,{format:D0?"NHWC":"NCHW",auto_pad:F,ceil_mode:K,count_include_pad:M,storage_order:O,dilations:$?Array.from(v().subarray(Number($)>>>0,Number(Z)>>>0)):[],kernel_shape:_?Array.from(v().subarray(Number(_)>>>0,Number(b)>>>0)):[],pads:y?Array.from(v().subarray(Number(y)>>>0,Number(c)>>>0)):[],strides:n?Array.from(v().subarray(Number(n)>>>0,Number(H0)>>>0)):[]})},1328986:(q,F)=>{Y.hc("GlobalMaxPool",q,{format:F?"NHWC":"NCHW"})},1329073:(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0)=>{Y.hc("MaxPool",q,{format:D0?"NHWC":"NCHW",auto_pad:F,ceil_mode:K,count_include_pad:M,storage_order:O,dilations:$?Array.from(v().subarray(Number($)>>>0,Number(Z)>>>0)):[],kernel_shape:_?Array.from(v().subarray(Number(_)>>>0,Number(b)>>>0)):[],pads:y?Array.from(v().subarray(Number(y)>>>0,Number(c)>>>0)):[],strides:n?Array.from(v().subarray(Number(n)>>>0,Number(H0)>>>0)):[]})},1329548:(q,F,K,M,O)=>{Y.hc("Gemm",q,{alpha:F,beta:K,transA:M,transB:O})},1329652:(q)=>{Y.hc("MatMul",q,void 0)},1329706:(q,F,K,M)=>{Y.hc("ArgMax",q,{keepDims:!!F,selectLastIndex:!!K,axis:M})},1329814:(q,F,K,M)=>{Y.hc("ArgMin",q,{keepDims:!!F,selectLastIndex:!!K,axis:M})},1329922:(q,F)=>{Y.hc("Softmax",q,{axis:F})},1329985:(q,F)=>{Y.hc("Concat",q,{axis:F})},1330045:(q,F,K,M,O)=>{Y.hc("Split",q,{axis:F,numOutputs:K,splitSizes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1330201:(q)=>{Y.hc("Expand",q,void 0)},1330255:(q,F)=>{Y.hc("Gather",q,{axis:Number(F)})},1330326:(q,F)=>{Y.hc("GatherElements",q,{axis:Number(F)})},1330405:(q,F)=>{Y.hc("GatherND",q,{batch_dims:Number(F)})},1330484:(q,F,K,M,O,$,Z,_,b,y,c)=>{Y.hc("Resize",q,{antialias:F,axes:K?Array.from(v().subarray(Number(K)>>>0,Number(M)>>>0)):[],coordinateTransformMode:b0(O),cubicCoeffA:$,excludeOutside:Z,extrapolationValue:_,keepAspectRatioPolicy:b0(b),mode:b0(y),nearestMode:b0(c)})},1330846:(q,F,K,M,O,$,Z)=>{Y.hc("Slice",q,{starts:F?Array.from(v().subarray(Number(F)>>>0,Number(K)>>>0)):[],ends:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[],axes:$?Array.from(v().subarray(Number($)>>>0,Number(Z)>>>0)):[]})},1331110:(q)=>{Y.hc("Tile",q,void 0)},1331162:(q,F,K)=>{Y.hc("InstanceNormalization",q,{epsilon:F,format:K?"NHWC":"NCHW"})},1331276:(q,F,K)=>{Y.hc("InstanceNormalization",q,{epsilon:F,format:K?"NHWC":"NCHW"})},1331390:(q)=>{Y.hc("Range",q,void 0)},1331443:(q,F)=>{Y.hc("Einsum",q,{equation:b0(F)})},1331524:(q,F,K,M,O)=>{Y.hc("Pad",q,{mode:F,value:K,pads:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1331667:(q,F,K,M,O,$)=>{Y.hc("BatchNormalization",q,{epsilon:F,momentum:K,spatial:!!O,trainingMode:!!M,format:$?"NHWC":"NCHW"})},1331836:(q,F,K,M,O,$)=>{Y.hc("BatchNormalization",q,{epsilon:F,momentum:K,spatial:!!O,trainingMode:!!M,format:$?"NHWC":"NCHW"})},1332005:(q,F,K)=>{Y.hc("CumSum",q,{exclusive:Number(F),reverse:Number(K)})},1332102:(q,F,K)=>{Y.hc("DequantizeLinear",q,{axis:F,blockSize:K})},1332192:(q,F,K,M,O)=>{Y.hc("GridSample",q,{align_corners:F,mode:b0(K),padding_mode:b0(M),format:O?"NHWC":"NCHW"})},1332362:(q,F,K,M,O)=>{Y.hc("GridSample",q,{align_corners:F,mode:b0(K),padding_mode:b0(M),format:O?"NHWC":"NCHW"})},1332532:(q,F)=>{Y.hc("ScatterND",q,{reduction:b0(F)})},1332617:(q,F,K,M,O,$,Z,_,b)=>{Y.hc("Attention",q,{numHeads:F,isUnidirectional:K,maskFilterValue:M,scale:O,doRotary:$,qkvHiddenSizes:Z?Array.from(v().subarray(Number(_)>>>0,Number(_)+Z>>>0)):[],pastPresentShareBuffer:!!b})},1332889:(q)=>{Y.hc("BiasAdd",q,void 0)},1332944:(q)=>{Y.hc("BiasSplitGelu",q,void 0)},1333005:(q)=>{Y.hc("FastGelu",q,void 0)},1333061:(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0,r0,r1)=>{Y.hc("Conv",q,{format:n?"NHWC":"NCHW",auto_pad:F,dilations:K?Array.from(v().subarray(Number(K)>>>0,Number(M)>>>0)):[],group:O,kernel_shape:$?Array.from(v().subarray(Number($)>>>0,Number(Z)>>>0)):[],pads:_?Array.from(v().subarray(Number(_)>>>0,Number(b)>>>0)):[],strides:y?Array.from(v().subarray(Number(y)>>>0,Number(c)>>>0)):[],w_is_const:()=>!!s()[Number(H0)>>>0],activation:b0(D0),activation_params:r0?Array.from(k0().subarray(Number(r0)>>>0,Number(r1)>>>0)):[]})},1333645:(q)=>{Y.hc("Gelu",q,void 0)},1333697:(q,F,K,M,O,$,Z,_,b)=>{Y.hc("GroupQueryAttention",q,{numHeads:F,kvNumHeads:K,scale:M,softcap:O,doRotary:$,rotaryInterleaved:Z,smoothSoftmax:_,localWindowSize:b})},1333914:(q,F,K,M)=>{Y.hc("LayerNormalization",q,{axis:F,epsilon:K,simplified:!!M})},1334025:(q,F,K,M)=>{Y.hc("LayerNormalization",q,{axis:F,epsilon:K,simplified:!!M})},1334136:(q,F,K,M,O,$)=>{Y.hc("MatMulNBits",q,{k:F,n:K,accuracyLevel:M,bits:O,blockSize:$})},1334263:(q,F,K,M,O,$)=>{Y.hc("MultiHeadAttention",q,{numHeads:F,isUnidirectional:K,maskFilterValue:M,scale:O,doRotary:$})},1334422:(q,F)=>{Y.hc("QuickGelu",q,{alpha:F})},1334486:(q,F,K,M,O)=>{Y.hc("RotaryEmbedding",q,{interleaved:!!F,numHeads:K,rotaryEmbeddingDim:M,scale:O})},1334625:(q,F,K)=>{Y.hc("SkipLayerNormalization",q,{epsilon:F,simplified:!!K})},1334727:(q,F,K)=>{Y.hc("SkipLayerNormalization",q,{epsilon:F,simplified:!!K})},1334829:(q,F,K,M)=>{Y.hc("GatherBlockQuantized",q,{gatherAxis:F,quantizeAxis:K,blockSize:M})},1334950:(q)=>{Y.Wd(q)},1334984:(q,F)=>Y.Zd(Number(q),Number(F),Y.Cd.be,Y.Cd.errors)};function k4(q,F,K){return r7(async()=>{await Y.Ud(Number(q),Number(F),Number(K))})}function C4(){return typeof wasmOffsetConverter<"u"}class A6{name="ExitStatus";constructor(q){this.message=`Program terminated with exit(${q})`,this.status=q}}var R7=(q)=>{q.terminate(),q.onmessage=()=>{}},Q8=[],E7=(q)=>{U1.length==0&&(S7(),P7(U1[0]));var F=U1.pop();if(!F)return 6;a1.push(F),S1[q.xd]=F,F.xd=q.xd;var K={yd:"run",de:q.ce,Fd:q.Fd,xd:q.xd};return F.postMessage(K,q.Ld),0},L1=0,$0=(q,F,...K)=>{for(var M=2*K.length,O=X0(),$=E8(8*M),Z=$>>>3,_=0;_<K.length;_++){var b=K[_];typeof b=="bigint"?(h[Z+2*_]=1n,h[Z+2*_+1]=b):(h[Z+2*_]=0n,o0()[Z+2*_+1>>>0]=b)}return q=E9(q,0,M,$,F),e(O),q};function X8(q){if(j)return $0(0,1,q);if(k=q,!(0<L1)){for(var F of a1)R7(F);for(F of U1)R7(F);U1=[],a1=[],S1={},G0=!0}E(0,new A6(q))}function D7(q){if(j)return $0(1,0,q);Y8(q)}var Y8=(q)=>{if(k=q,j)throw D7(q),"unwind";X8(q)},U1=[],a1=[],A7=[],S1={},z7=(q)=>{var F=q.xd;delete S1[F],U1.push(q),a1.splice(a1.indexOf(q),1),q.xd=0,D9(F)};function $7(){A7.forEach((q)=>q())}var P7=(q)=>new Promise((F)=>{q.onmessage=(O)=>{var $=(O=O.data).yd;if(O.Ed&&O.Ed!=b6()){var Z=S1[O.Ed];Z?Z.postMessage(O,O.Ld):D(`Internal error! Worker sent a message "${$}" to target pthread ${O.Ed}, but that thread no longer exists!`)}else $==="checkMailbox"?P6():$==="spawnThread"?E7(O):$==="cleanupThread"?z7(S1[O.ee]):$==="loaded"?(q.loaded=!0,F(q)):$==="alert"?alert(`Thread ${O.fe}: ${O.text}`):O.target==="setimmediate"?q.postMessage(O):$==="callHandler"?Y[O.Nd](...O.args):$&&D(`worker sent an unknown command ${$}`)},q.onerror=(O)=>{throw D(`worker sent an error! ${O.filename}:${O.lineno}: ${O.message}`),O};var K,M=[];for(K of[])Y.propertyIsEnumerable(K)&&M.push(K);q.postMessage({yd:"load",Od:M,he:S,ie:w})});function S7(){var q=new Worker(import.meta.url.startsWith("file:")?new URL("ort.webgpu.bundle.min.mjs",import.meta.url):new URL(import.meta.url),{type:"module",workerData:"em-pthread",name:"em-pthread"});U1.push(q)}var I4=(q)=>{u0();var F=r()[q+52>>>2>>>0];q=r()[q+56>>>2>>>0],$9(F,F-q),e(F)},_4=(q,F)=>{L1=0,q=D8(q,F),0<L1?k=q:R8(q)},z6=[];function b4(q){var F=new $6(q>>>=0);if(s()[F.wd+12>>>0]==0){var K=1;s()[F.wd+12>>>0]=K}return K=0,s()[F.wd+13>>>0]=K,z6.push(F),S9(q),w9(q)}var I1=0,v4=()=>{Y0(0,0);var q=z6.pop();P9(q.Gd),I1=0};class $6{constructor(q){this.Gd=q,this.wd=q-24}}function T4(q){throw I1||=q>>>0,I1}var H8=(q)=>{var F=I1;if(!F)return n1(0),0;var K=new $6(F);r()[K.wd+16>>>2>>>0]=F;var M=r()[K.wd+4>>>2>>>0];if(!M)return n1(0),F;for(var O of q){if(O===0||O===M)break;if(Z9(O,M,K.wd+16))return n1(O),F}return n1(M),F};function x4(){return H8([])}function f4(q){return H8([q>>>0])}function h4(q,F){return H8([q>>>0,F>>>0])}var y4=()=>{var q=z6.pop();q||W1("no exception to throw");var F=q.Gd;if(s()[q.wd+13>>>0]==0){z6.push(q);var K=1;s()[q.wd+13>>>0]=K,K=0,s()[q.wd+12>>>0]=K}throw I1=F};function g4(q,F,K){var M=new $6(q>>>=0);throw F>>>=0,K>>>=0,r()[M.wd+16>>>2>>>0]=0,r()[M.wd+4>>>2>>>0]=F,r()[M.wd+8>>>2>>>0]=K,I1=q}function Z7(q,F,K,M){return j?$0(2,1,q,F,K,M):w7(q,F,K,M)}function w7(q,F,K,M){if(q>>>=0,K>>>=0,M>>>=0,N===void 0)return 6;var O=[];return j&&O.length===0?Z7(q,F>>>=0,K,M):(q={ce:K,xd:q,Fd:M,Ld:O},j?(q.yd="spawnThread",postMessage(q,O),0):E7(q))}var k7=typeof TextDecoder<"u"?new TextDecoder:void 0,C7=(q,F=0,K=NaN)=>{var M=(F>>>=0)+K;for(K=F;q[K]&&!(K>=M);)++K;if(16<K-F&&q.buffer&&k7)return k7.decode(q.buffer instanceof ArrayBuffer?q.subarray(F,K):q.slice(F,K));for(M="";F<K;){var O=q[F++];if(128&O){var $=63&q[F++];if((224&O)==192)M+=String.fromCharCode((31&O)<<6|$);else{var Z=63&q[F++];65536>(O=(240&O)==224?(15&O)<<12|$<<6|Z:(7&O)<<18|$<<12|Z<<6|63&q[F++])?M+=String.fromCharCode(O):(O-=65536,M+=String.fromCharCode(55296|O>>10,56320|1023&O))}}else M+=String.fromCharCode(O)}return M},b0=(q,F)=>(q>>>=0)?C7(N0(),q,F):"";function I7(q,F,K){return j?$0(3,1,q,F,K):0}function _7(q,F){if(j)return $0(4,1,q,F)}var b7=(q)=>{for(var F=0,K=0;K<q.length;++K){var M=q.charCodeAt(K);127>=M?F++:2047>=M?F+=2:55296<=M&&57343>=M?(F+=4,++K):F+=3}return F},_1=(q,F,K)=>{var M=N0();if(F>>>=0,0<K){var O=F;K=F+K-1;for(var $=0;$<q.length;++$){var Z=q.charCodeAt($);if(55296<=Z&&57343>=Z&&(Z=65536+((1023&Z)<<10)|1023&q.charCodeAt(++$)),127>=Z){if(F>=K)break;M[F++>>>0]=Z}else{if(2047>=Z){if(F+1>=K)break;M[F++>>>0]=192|Z>>6}else{if(65535>=Z){if(F+2>=K)break;M[F++>>>0]=224|Z>>12}else{if(F+3>=K)break;M[F++>>>0]=240|Z>>18,M[F++>>>0]=128|Z>>12&63}M[F++>>>0]=128|Z>>6&63}M[F++>>>0]=128|63&Z}}M[F>>>0]=0,q=F-O}else q=0;return q};function v7(q,F){if(j)return $0(5,1,q,F)}function T7(q,F,K){if(j)return $0(6,1,q,F,K)}function x7(q,F,K){return j?$0(7,1,q,F,K):0}function f7(q,F){if(j)return $0(8,1,q,F)}function h7(q,F,K){if(j)return $0(9,1,q,F,K)}function y7(q,F,K,M){if(j)return $0(10,1,q,F,K,M)}function g7(q,F,K,M){if(j)return $0(11,1,q,F,K,M)}function l7(q,F,K,M){if(j)return $0(12,1,q,F,K,M)}function m7(q){if(j)return $0(13,1,q)}function p7(q,F){if(j)return $0(14,1,q,F)}function c7(q,F,K){if(j)return $0(15,1,q,F,K)}var d7,O1,l4=()=>W1(""),X1=(q)=>{for(var F="";N0()[q>>>0];)F+=d7[N0()[q++>>>0]];return F},q8={},W8={},m4={};function G1(q,F,K={}){return function(M,O,$={}){var Z=O.name;if(!M)throw new O1(`type "${Z}" must have a positive integer typeid pointer`);if(W8.hasOwnProperty(M)){if($.Pd)return;throw new O1(`Cannot register type '${Z}' twice`)}W8[M]=O,delete m4[M],q8.hasOwnProperty(M)&&(O=q8[M],delete q8[M],O.forEach((_)=>_()))}(q,F,K)}var u7=(q,F,K)=>{switch(F){case 1:return K?(M)=>s()[M>>>0]:(M)=>N0()[M>>>0];case 2:return K?(M)=>f()[M>>>1>>>0]:(M)=>p()[M>>>1>>>0];case 4:return K?(M)=>v()[M>>>2>>>0]:(M)=>r()[M>>>2>>>0];case 8:return K?(M)=>h[M>>>3]:(M)=>W0[M>>>3];default:throw TypeError(`invalid integer width (${F}): ${q}`)}};function p4(q,F,K){K>>>=0,G1(q>>>=0,{name:F=X1(F>>>0),fromWireType:(M)=>M,toWireType:function(M,O){if(typeof O!="bigint"&&typeof O!="number")throw O=O===null?"null":(M=typeof O)=="object"||M==="array"||M==="function"?O.toString():""+O,TypeError(`Cannot convert "${O}" to ${this.name}`);return typeof O=="number"&&(O=BigInt(O)),O},zd:R1,readValueFromPointer:u7(F,K,F.indexOf("u")==-1),Ad:null})}var R1=8;function c4(q,F,K,M){G1(q>>>=0,{name:F=X1(F>>>0),fromWireType:function(O){return!!O},toWireType:function(O,$){return $?K:M},zd:R1,readValueFromPointer:function(O){return this.fromWireType(N0()[O>>>0])},Ad:null})}var G8=[],j1=[];function j8(q){9<(q>>>=0)&&--j1[q+1]==0&&(j1[q]=void 0,G8.push(q))}var s0=(q)=>{if(!q)throw new O1("Cannot use deleted val. handle = "+q);return j1[q]},n0=(q)=>{switch(q){case void 0:return 2;case null:return 4;case!0:return 6;case!1:return 8;default:let F=G8.pop()||j1.length;return j1[F]=q,j1[F+1]=1,F}};function F8(q){return this.fromWireType(r()[q>>>2>>>0])}var d4={name:"emscripten::val",fromWireType:(q)=>{var F=s0(q);return j8(q),F},toWireType:(q,F)=>n0(F),zd:R1,readValueFromPointer:F8,Ad:null};function u4(q){return G1(q>>>0,d4)}var o4=(q,F)=>{switch(F){case 4:return function(K){return this.fromWireType(k0()[K>>>2>>>0])};case 8:return function(K){return this.fromWireType(o0()[K>>>3>>>0])};default:throw TypeError(`invalid float width (${F}): ${q}`)}};function s4(q,F,K){K>>>=0,G1(q>>>=0,{name:F=X1(F>>>0),fromWireType:(M)=>M,toWireType:(M,O)=>O,zd:R1,readValueFromPointer:o4(F,K),Ad:null})}function a4(q,F,K,M,O){if(q>>>=0,K>>>=0,F=X1(F>>>0),O===-1&&(O=4294967295),O=(_)=>_,M===0){var $=32-8*K;O=(_)=>_<<$>>>$}var Z=F.includes("unsigned")?function(_,b){return b>>>0}:function(_,b){return b};G1(q,{name:F,fromWireType:O,toWireType:Z,zd:R1,readValueFromPointer:u7(F,K,M!==0),Ad:null})}function i4(q,F,K){function M($){var Z=r()[$>>>2>>>0];return $=r()[$+4>>>2>>>0],new O(s().buffer,$,Z)}var O=[Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array,BigInt64Array,BigUint64Array][F];G1(q>>>=0,{name:K=X1(K>>>0),fromWireType:M,zd:R1,readValueFromPointer:M},{Pd:!0})}function n4(q,F){G1(q>>>=0,{name:F=X1(F>>>0),fromWireType:function(K){for(var M,O=r()[K>>>2>>>0],$=K+4,Z=$,_=0;_<=O;++_){var b=$+_;_!=O&&N0()[b>>>0]!=0||(Z=b0(Z,b-Z),M===void 0?M=Z:(M+="\x00",M+=Z),Z=b+1)}return H1(K),M},toWireType:function(K,M){M instanceof ArrayBuffer&&(M=new Uint8Array(M));var O=typeof M=="string";if(!(O||M instanceof Uint8Array||M instanceof Uint8ClampedArray||M instanceof Int8Array))throw new O1("Cannot pass non-string to std::string");var $=O?b7(M):M.length,Z=v6(4+$+1),_=Z+4;if(r()[Z>>>2>>>0]=$,O)_1(M,_,$+1);else if(O)for(O=0;O<$;++O){var b=M.charCodeAt(O);if(255<b)throw H1(Z),new O1("String has UTF-16 code units that do not fit in 8 bits");N0()[_+O>>>0]=b}else for(O=0;O<$;++O)N0()[_+O>>>0]=M[O];return K!==null&&K.push(H1,Z),Z},zd:R1,readValueFromPointer:F8,Ad(K){H1(K)}})}var o7=typeof TextDecoder<"u"?new TextDecoder("utf-16le"):void 0,r4=(q,F)=>{for(var K=q>>1,M=K+F/2;!(K>=M)&&p()[K>>>0];)++K;if(32<(K<<=1)-q&&o7)return o7.decode(N0().slice(q,K));for(K="",M=0;!(M>=F/2);++M){var O=f()[q+2*M>>>1>>>0];if(O==0)break;K+=String.fromCharCode(O)}return K},t4=(q,F,K)=>{if(K??=2147483647,2>K)return 0;var M=F;K=(K-=2)<2*q.length?K/2:q.length;for(var O=0;O<K;++O){var $=q.charCodeAt(O);f()[F>>>1>>>0]=$,F+=2}return f()[F>>>1>>>0]=0,F-M},e4=(q)=>2*q.length,JJ=(q,F)=>{for(var K=0,M="";!(K>=F/4);){var O=v()[q+4*K>>>2>>>0];if(O==0)break;++K,65536<=O?(O-=65536,M+=String.fromCharCode(55296|O>>10,56320|1023&O)):M+=String.fromCharCode(O)}return M},QJ=(q,F,K)=>{if(F>>>=0,K??=2147483647,4>K)return 0;var M=F;K=M+K-4;for(var O=0;O<q.length;++O){var $=q.charCodeAt(O);if(55296<=$&&57343>=$&&($=65536+((1023&$)<<10)|1023&q.charCodeAt(++O)),v()[F>>>2>>>0]=$,(F+=4)+4>K)break}return v()[F>>>2>>>0]=0,F-M},XJ=(q)=>{for(var F=0,K=0;K<q.length;++K){var M=q.charCodeAt(K);55296<=M&&57343>=M&&++K,F+=4}return F};function YJ(q,F,K){if(q>>>=0,F>>>=0,K=X1(K>>>=0),F===2)var M=r4,O=t4,$=e4,Z=(_)=>p()[_>>>1>>>0];else F===4&&(M=JJ,O=QJ,$=XJ,Z=(_)=>r()[_>>>2>>>0]);G1(q,{name:K,fromWireType:(_)=>{for(var b,y=r()[_>>>2>>>0],c=_+4,n=0;n<=y;++n){var H0=_+4+n*F;n!=y&&Z(H0)!=0||(c=M(c,H0-c),b===void 0?b=c:(b+="\x00",b+=c),c=H0+F)}return H1(_),b},toWireType:(_,b)=>{if(typeof b!="string")throw new O1(`Cannot pass non-string to C++ string type ${K}`);var y=$(b),c=v6(4+y+F);return r()[c>>>2>>>0]=y/F,O(b,c+4,y+F),_!==null&&_.push(H1,c),c},zd:R1,readValueFromPointer:F8,Ad(_){H1(_)}})}function HJ(q,F){G1(q>>>=0,{Qd:!0,name:F=X1(F>>>0),zd:0,fromWireType:()=>{},toWireType:()=>{}})}function qJ(q){O8(q>>>0,!G,1,!W,131072,!1),$7()}var N8=(q)=>{if(!G0)try{if(q(),!(0<L1))try{j?R8(k):Y8(k)}catch(F){F instanceof A6||F=="unwind"||E(0,F)}}catch(F){F instanceof A6||F=="unwind"||E(0,F)}};function V8(q){q>>>=0,typeof Atomics.ge=="function"&&(Atomics.ge(v(),q>>>2,q).value.then(P6),q+=128,Atomics.store(v(),q>>>2,1))}var P6=()=>{var q=b6();q&&(V8(q),N8(z9))};function WJ(q,F){(q>>>=0)==F>>>0?setTimeout(P6):j?postMessage({Ed:q,yd:"checkMailbox"}):(q=S1[q])&&q.postMessage({yd:"checkMailbox"})}var K8=[];function GJ(q,F,K,M,O){for(F>>>=0,M/=2,K8.length=M,K=O>>>0>>>3,O=0;O<M;O++)K8[O]=h[K+2*O]?h[K+2*O+1]:o0()[K+2*O+1>>>0];return(F?J8[F]:JQ[q])(...K8)}var jJ=()=>{L1=0};function FJ(q){q>>>=0,j?postMessage({yd:"cleanupThread",ee:q}):z7(S1[q])}function NJ(q){}var S6=(q,F)=>{var K=W8[q];if(K===void 0)throw q=U9(q),K=X1(q),H1(q),new O1(`${F} has unknown type ${K}`);return K},s7=(q,F,K)=>{var M=[];return q=q.toWireType(M,K),M.length&&(r()[F>>>2>>>0]=n0(M)),q};function VJ(q,F,K){return F>>>=0,K>>>=0,q=s0(q>>>0),F=S6(F,"emval::as"),s7(F,K,q)}function KJ(q,F){return F>>>=0,q=s0(q>>>0),(F=S6(F,"emval::as")).toWireType(null,q)}var Z6=(q)=>{try{q()}catch(F){W1(F)}},E1=0,Y1=null,a7=0,w6=[],i7={},n7={},MJ=0,M8=null,BJ=[];function r7(q){return function(F){if(!G0){if(E1===0){var K=!1,M=!1;F((O=0)=>{if(!G0&&(a7=O,K=!0,M)){E1=2,Z6(()=>D2(Y1)),typeof MainLoop<"u"&&MainLoop.Md&&MainLoop.resume(),O=!1;try{var $=function(){var b=v()[Y1+8>>>2>>>0];return b=x[n7[b]],--L1,b()}()}catch(b){$=b,O=!0}var Z=!1;if(!Y1){var _=M8;_&&(M8=null,(O?_.reject:_.resolve)($),Z=!0)}if(O&&!Z)throw $}}),M=!0,K||(E1=1,Y1=function(){var O=v6(65548),$=O+12;r()[O>>>2>>>0]=$,r()[O+4>>>2>>>0]=$+65536,$=w6[0];var Z=i7[$];return Z===void 0&&(Z=MJ++,i7[$]=Z,n7[Z]=$),$=Z,v()[O+8>>>2>>>0]=$,O}(),typeof MainLoop<"u"&&MainLoop.Md&&MainLoop.pause(),Z6(()=>R2(Y1)))}else E1===2?(E1=0,Z6(A2),H1(Y1),Y1=null,BJ.forEach(N8)):W1(`invalid state: ${E1}`);return a7}}((F)=>{q().then(F)})}function LJ(q){return q>>>=0,r7(async()=>{var F=await s0(q);return n0(F)})}var k6=[];function UJ(q,F,K,M){return K>>>=0,M>>>=0,(q=k6[q>>>0])(null,F=s0(F>>>0),K,M)}var OJ={},C6=(q)=>{var F=OJ[q];return F===void 0?X1(q):F};function RJ(q,F,K,M,O){return K>>>=0,M>>>=0,O>>>=0,(q=k6[q>>>0])(F=s0(F>>>0),F[K=C6(K)],M,O)}var t7=()=>typeof globalThis=="object"?globalThis:Function("return this")();function EJ(q){return(q>>>=0)==0?n0(t7()):(q=C6(q),n0(t7()[q]))}var DJ=(q)=>{var F=k6.length;return k6.push(q),F},AJ=(q,F)=>{for(var K=Array(q),M=0;M<q;++M)K[M]=S6(r()[F+4*M>>>2>>>0],"parameter "+M);return K},e7=(q,F)=>Object.defineProperty(F,"name",{value:q});function zJ(q,F,K){var M=(F=AJ(q,F>>>0)).shift();q--;var O=`return function (obj, func, destructorsRef, args) {
`,$=0,Z=[];K===0&&Z.push("obj");for(var _=["retType"],b=[M],y=0;y<q;++y)Z.push("arg"+y),_.push("argType"+y),b.push(F[y]),O+=`  var arg${y} = argType${y}.readValueFromPointer(args${$?"+"+$:""});
`,$+=F[y].zd;return O+=`  var rv = ${K===1?"new func":"func.call"}(${Z.join(", ")});
`,M.Qd||(_.push("emval_returnValue"),b.push(s7),O+=`  return emval_returnValue(retType, destructorsRef, rv);
`),_.push(O+`};
`),q=function(c){var n=Function;if(!(n instanceof Function))throw TypeError(`new_ called with constructor type ${typeof n} which is not a function`);var H0=e7(n.name||"unknownFunctionName",function(){});return H0.prototype=n.prototype,H0=new H0,(c=n.apply(H0,c))instanceof Object?c:H0}(_)(...b),K=`methodCaller<(${F.map((c)=>c.name).join(", ")}) => ${M.name}>`,DJ(e7(K,q))}function $J(q){return q=C6(q>>>0),n0(Y[q])}function PJ(q,F){return F>>>=0,q=s0(q>>>0),F=s0(F),n0(q[F])}function SJ(q){9<(q>>>=0)&&(j1[q+1]+=1)}function ZJ(){return n0([])}function wJ(q){q=s0(q>>>0);for(var F=Array(q.length),K=0;K<q.length;K++)F[K]=q[K];return n0(F)}function kJ(q){return n0(C6(q>>>0))}function CJ(){return n0({})}function IJ(q){for(var F=s0(q>>>=0);F.length;){var K=F.pop();F.pop()(K)}j8(q)}function _J(q,F,K){F>>>=0,K>>>=0,q=s0(q>>>0),F=s0(F),K=s0(K),q[F]=K}function bJ(q,F){return F>>>=0,q=(q=S6(q>>>0,"_emval_take_value")).readValueFromPointer(F),n0(q)}function vJ(q,F){q=-9007199254740992>q||9007199254740992<q?NaN:Number(q),F>>>=0,q=new Date(1000*q),v()[F>>>2>>>0]=q.getUTCSeconds(),v()[F+4>>>2>>>0]=q.getUTCMinutes(),v()[F+8>>>2>>>0]=q.getUTCHours(),v()[F+12>>>2>>>0]=q.getUTCDate(),v()[F+16>>>2>>>0]=q.getUTCMonth(),v()[F+20>>>2>>>0]=q.getUTCFullYear()-1900,v()[F+24>>>2>>>0]=q.getUTCDay(),q=(q.getTime()-Date.UTC(q.getUTCFullYear(),0,1,0,0,0,0))/86400000|0,v()[F+28>>>2>>>0]=q}var J9=(q)=>q%4==0&&(q%100!=0||q%400==0),Q9=[0,31,60,91,121,152,182,213,244,274,305,335],X9=[0,31,59,90,120,151,181,212,243,273,304,334];function TJ(q,F){q=-9007199254740992>q||9007199254740992<q?NaN:Number(q),F>>>=0,q=new Date(1000*q),v()[F>>>2>>>0]=q.getSeconds(),v()[F+4>>>2>>>0]=q.getMinutes(),v()[F+8>>>2>>>0]=q.getHours(),v()[F+12>>>2>>>0]=q.getDate(),v()[F+16>>>2>>>0]=q.getMonth(),v()[F+20>>>2>>>0]=q.getFullYear()-1900,v()[F+24>>>2>>>0]=q.getDay();var K=(J9(q.getFullYear())?Q9:X9)[q.getMonth()]+q.getDate()-1|0;v()[F+28>>>2>>>0]=K,v()[F+36>>>2>>>0]=-60*q.getTimezoneOffset(),K=new Date(q.getFullYear(),6,1).getTimezoneOffset();var M=new Date(q.getFullYear(),0,1).getTimezoneOffset();q=0|(K!=M&&q.getTimezoneOffset()==Math.min(M,K)),v()[F+32>>>2>>>0]=q}function xJ(q){q>>>=0;var F=new Date(v()[q+20>>>2>>>0]+1900,v()[q+16>>>2>>>0],v()[q+12>>>2>>>0],v()[q+8>>>2>>>0],v()[q+4>>>2>>>0],v()[q>>>2>>>0],0),K=v()[q+32>>>2>>>0],M=F.getTimezoneOffset(),O=new Date(F.getFullYear(),6,1).getTimezoneOffset(),$=new Date(F.getFullYear(),0,1).getTimezoneOffset(),Z=Math.min($,O);return 0>K?v()[q+32>>>2>>>0]=+(O!=$&&Z==M):0<K!=(Z==M)&&(O=Math.max($,O),F.setTime(F.getTime()+60000*((0<K?Z:O)-M))),v()[q+24>>>2>>>0]=F.getDay(),K=(J9(F.getFullYear())?Q9:X9)[F.getMonth()]+F.getDate()-1|0,v()[q+28>>>2>>>0]=K,v()[q>>>2>>>0]=F.getSeconds(),v()[q+4>>>2>>>0]=F.getMinutes(),v()[q+8>>>2>>>0]=F.getHours(),v()[q+12>>>2>>>0]=F.getDate(),v()[q+16>>>2>>>0]=F.getMonth(),v()[q+20>>>2>>>0]=F.getYear(),q=F.getTime(),BigInt(isNaN(q)?-1:q/1000)}function Y9(q,F,K,M,O,$,Z){return j?$0(16,1,q,F,K,M,O,$,Z):-52}function H9(q,F,K,M,O,$){if(j)return $0(17,1,q,F,K,M,O,$)}var i1={},fJ=()=>performance.timeOrigin+performance.now();function q9(q,F){if(j)return $0(18,1,q,F);if(i1[q]&&(clearTimeout(i1[q].id),delete i1[q]),!F)return 0;var K=setTimeout(()=>{delete i1[q],N8(()=>A9(q,performance.timeOrigin+performance.now()))},F);return i1[q]={id:K,ke:F},0}function hJ(q,F,K,M){q>>>=0,F>>>=0,K>>>=0,M>>>=0;var O=new Date().getFullYear(),$=new Date(O,0,1).getTimezoneOffset();O=new Date(O,6,1).getTimezoneOffset();var Z=Math.max($,O);r()[q>>>2>>>0]=60*Z,v()[F>>>2>>>0]=+($!=O),q=(F=(_)=>{var b=Math.abs(_);return`UTC${0<=_?"-":"+"}${String(Math.floor(b/60)).padStart(2,"0")}${String(b%60).padStart(2,"0")}`})($),F=F(O),O<$?(_1(q,K,17),_1(F,M,17)):(_1(q,M,17),_1(F,K,17))}var yJ=()=>Date.now(),gJ=1;function lJ(q,F,K){if(!(0<=q&&3>=q))return 28;if(q===0)q=Date.now();else{if(!gJ)return 52;q=performance.timeOrigin+performance.now()}return h[K>>>0>>>3]=BigInt(Math.round(1e6*q)),0}var B8=[],W9=(q,F)=>{B8.length=0;for(var K;K=N0()[q++>>>0];){var M=K!=105;F+=(M&=K!=112)&&F%8?4:0,B8.push(K==112?r()[F>>>2>>>0]:K==106?h[F>>>3]:K==105?v()[F>>>2>>>0]:o0()[F>>>3>>>0]),F+=M?8:4}return B8};function mJ(q,F,K){return q>>>=0,F=W9(F>>>0,K>>>0),J8[q](...F)}function pJ(q,F,K){return q>>>=0,F=W9(F>>>0,K>>>0),J8[q](...F)}var cJ=()=>{};function dJ(q,F){return D(b0(q>>>0,F>>>0))}var uJ=()=>{throw L1+=1,"unwind"};function oJ(){return 4294901760}var sJ=()=>navigator.hardwareConcurrency;function aJ(){return W1("Cannot use emscripten_pc_get_function without -sUSE_OFFSET_CONVERTER"),0}function iJ(q){q>>>=0;var F=N0().length;if(q<=F||4294901760<q)return!1;for(var K=1;4>=K;K*=2){var M=F*(1+0.2/K);M=Math.min(M,q+100663296);J:{M=(Math.min(4294901760,65536*Math.ceil(Math.max(q,M)/65536))-S.buffer.byteLength+65535)/65536|0;try{S.grow(M),u0();var O=1;break J}catch{}O=void 0}if(O)return!0}return!1}var I6=()=>(W1("Cannot use convertFrameToPC (needed by __builtin_return_address) without -sUSE_OFFSET_CONVERTER"),0),b1={},G9=(q)=>{q.forEach((F)=>{var K=I6();K&&(b1[K]=F)})};function nJ(){var q=Error().stack.toString().split(`
`);return q[0]=="Error"&&q.shift(),G9(q),b1.Kd=I6(),b1.ae=q,b1.Kd}function rJ(q,F,K){if(q>>>=0,F>>>=0,b1.Kd==q)var M=b1.ae;else(M=Error().stack.toString().split(`
`))[0]=="Error"&&M.shift(),G9(M);for(var O=3;M[O]&&I6()!=q;)++O;for(q=0;q<K&&M[q+O];++q)v()[F+4*q>>>2>>>0]=I6();return q}var L8,U8={},j9=()=>{if(!L8){var q,F={USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user",LANG:(typeof navigator=="object"&&navigator.languages&&navigator.languages[0]||"C").replace("-","_")+".UTF-8",_:"./this.program"};for(q in U8)U8[q]===void 0?delete F[q]:F[q]=U8[q];var K=[];for(q in F)K.push(`${q}=${F[q]}`);L8=K}return L8};function F9(q,F){if(j)return $0(19,1,q,F);q>>>=0,F>>>=0;var K=0;return j9().forEach((M,O)=>{var $=F+K;for(O=r()[q+4*O>>>2>>>0]=$,$=0;$<M.length;++$)s()[O++>>>0]=M.charCodeAt($);s()[O>>>0]=0,K+=M.length+1}),0}function N9(q,F){if(j)return $0(20,1,q,F);q>>>=0,F>>>=0;var K=j9();r()[q>>>2>>>0]=K.length;var M=0;return K.forEach((O)=>M+=O.length+1),r()[F>>>2>>>0]=M,0}function V9(q){return j?$0(21,1,q):52}function K9(q,F,K,M){return j?$0(22,1,q,F,K,M):52}function M9(q,F,K,M){return j?$0(23,1,q,F,K,M):70}var tJ=[null,[],[]];function B9(q,F,K,M){if(j)return $0(24,1,q,F,K,M);F>>>=0,K>>>=0,M>>>=0;for(var O=0,$=0;$<K;$++){var Z=r()[F>>>2>>>0],_=r()[F+4>>>2>>>0];F+=8;for(var b=0;b<_;b++){var y=N0()[Z+b>>>0],c=tJ[q];y===0||y===10?((q===1?z:D)(C7(c)),c.length=0):c.push(y)}O+=_}return r()[M>>>2>>>0]=O,0}function eJ(q){return q>>>0}j||function(){for(var q=Y.numThreads-1;q--;)S7();Q8.unshift(()=>{o1++,function(F){j?F():Promise.all(U1.map(P7)).then(F)}(()=>U7())})}();for(var L9=Array(256),_6=0;256>_6;++_6)L9[_6]=String.fromCharCode(_6);d7=L9,O1=Y.BindingError=class extends Error{constructor(q){super(q),this.name="BindingError"}},Y.InternalError=class extends Error{constructor(q){super(q),this.name="InternalError"}},j1.push(0,1,void 0,1,null,1,!0,1,!1,1),Y.count_emval_handles=()=>j1.length/2-5-G8.length;var x,JQ=[X8,D7,Z7,I7,_7,v7,T7,x7,f7,h7,y7,g7,l7,m7,p7,c7,Y9,H9,q9,F9,N9,V9,K9,M9,B9];(async function(){function q(M,O){return x=M.exports,x=function(){var $=x,Z={};for(let[_,b]of Object.entries($))Z[_]=typeof b=="function"?(...y)=>{w6.push(_);try{return b(...y)}finally{G0||(w6.pop(),Y1&&E1===1&&w6.length===0&&(E1=0,L1+=1,Z6(E2),typeof Fibers<"u"&&Fibers.le()))}}:b;return Z}(),x=function(){var $=x,Z=(b)=>(y)=>b(y)>>>0,_=(b)=>()=>b()>>>0;return($=Object.assign({},$)).Cb=Z($.Cb),$.fc=_($.fc),$.ic=Z($.ic),$.vc=Z($.vc),$.wc=_($.wc),$.Ac=Z($.Ac),$}(),A7.push(x.jc),w=O,U7(),x}o1++;var F=O7();if(Y.instantiateWasm)return new Promise((M)=>{Y.instantiateWasm(F,(O,$)=>{q(O,$),M(O.exports)})});if(j)return new Promise((M)=>{_0=(O)=>{var $=new WebAssembly.Instance(O,O7());M(q($,O))}});e6??=Y.locateFile?Y.locateFile?Y.locateFile("ort-wasm-simd-threaded.jsep.wasm",R):R+"ort-wasm-simd-threaded.jsep.wasm":new URL("ort-wasm-simd-threaded.jsep.wasm",import.meta.url).href;try{var K=await async function(M){var O=e6;if(!o&&typeof WebAssembly.instantiateStreaming=="function"&&!F0(O))try{var $=fetch(O,{credentials:"same-origin"});return await WebAssembly.instantiateStreaming($,M)}catch(Z){D(`wasm streaming compile failed: ${Z}`),D("falling back to ArrayBuffer instantiation")}return async function(Z,_){try{var b=await async function(y){if(!o)try{var c=await L(y);return new Uint8Array(c)}catch{}if(y==e6&&o)y=new Uint8Array(o);else{if(!B)throw"both async and sync fetching of the wasm failed";y=B(y)}return y}(Z);return await WebAssembly.instantiate(b,_)}catch(y){D(`failed to asynchronously prepare wasm: ${y}`),W1(y)}}(O,M)}(F);return q(K.instance,K.module)}catch(M){return X(M),Promise.reject(M)}})();var U9=(q)=>(U9=x.Cb)(q),O9=()=>(O9=x.Db)();Y._OrtInit=(q,F)=>(Y._OrtInit=x.Eb)(q,F),Y._OrtGetLastError=(q,F)=>(Y._OrtGetLastError=x.Fb)(q,F),Y._OrtCreateSessionOptions=(q,F,K,M,O,$,Z,_,b,y)=>(Y._OrtCreateSessionOptions=x.Gb)(q,F,K,M,O,$,Z,_,b,y),Y._OrtAppendExecutionProvider=(q,F)=>(Y._OrtAppendExecutionProvider=x.Hb)(q,F),Y._OrtAddFreeDimensionOverride=(q,F,K)=>(Y._OrtAddFreeDimensionOverride=x.Ib)(q,F,K),Y._OrtAddSessionConfigEntry=(q,F,K)=>(Y._OrtAddSessionConfigEntry=x.Jb)(q,F,K),Y._OrtReleaseSessionOptions=(q)=>(Y._OrtReleaseSessionOptions=x.Kb)(q),Y._OrtCreateSession=(q,F,K)=>(Y._OrtCreateSession=x.Lb)(q,F,K),Y._OrtReleaseSession=(q)=>(Y._OrtReleaseSession=x.Mb)(q),Y._OrtGetInputOutputCount=(q,F,K)=>(Y._OrtGetInputOutputCount=x.Nb)(q,F,K),Y._OrtGetInputName=(q,F)=>(Y._OrtGetInputName=x.Ob)(q,F),Y._OrtGetOutputName=(q,F)=>(Y._OrtGetOutputName=x.Pb)(q,F),Y._OrtFree=(q)=>(Y._OrtFree=x.Qb)(q),Y._OrtCreateTensor=(q,F,K,M,O,$)=>(Y._OrtCreateTensor=x.Rb)(q,F,K,M,O,$),Y._OrtGetTensorData=(q,F,K,M,O)=>(Y._OrtGetTensorData=x.Sb)(q,F,K,M,O),Y._OrtReleaseTensor=(q)=>(Y._OrtReleaseTensor=x.Tb)(q),Y._OrtCreateRunOptions=(q,F,K,M)=>(Y._OrtCreateRunOptions=x.Ub)(q,F,K,M),Y._OrtAddRunConfigEntry=(q,F,K)=>(Y._OrtAddRunConfigEntry=x.Vb)(q,F,K),Y._OrtReleaseRunOptions=(q)=>(Y._OrtReleaseRunOptions=x.Wb)(q),Y._OrtCreateBinding=(q)=>(Y._OrtCreateBinding=x.Xb)(q),Y._OrtBindInput=(q,F,K)=>(Y._OrtBindInput=x.Yb)(q,F,K),Y._OrtBindOutput=(q,F,K,M)=>(Y._OrtBindOutput=x.Zb)(q,F,K,M),Y._OrtClearBoundOutputs=(q)=>(Y._OrtClearBoundOutputs=x._b)(q),Y._OrtReleaseBinding=(q)=>(Y._OrtReleaseBinding=x.$b)(q),Y._OrtRunWithBinding=(q,F,K,M,O)=>(Y._OrtRunWithBinding=x.ac)(q,F,K,M,O),Y._OrtRun=(q,F,K,M,O,$,Z,_)=>(Y._OrtRun=x.bc)(q,F,K,M,O,$,Z,_),Y._OrtEndProfiling=(q)=>(Y._OrtEndProfiling=x.cc)(q),Y._JsepOutput=(q,F,K)=>(Y._JsepOutput=x.dc)(q,F,K),Y._JsepGetNodeName=(q)=>(Y._JsepGetNodeName=x.ec)(q);var b6=()=>(b6=x.fc)(),H1=Y._free=(q)=>(H1=Y._free=x.gc)(q),v6=Y._malloc=(q)=>(v6=Y._malloc=x.ic)(q),O8=(q,F,K,M,O,$)=>(O8=x.kc)(q,F,K,M,O,$),R9=()=>(R9=x.lc)(),E9=(q,F,K,M,O)=>(E9=x.mc)(q,F,K,M,O),D9=(q)=>(D9=x.nc)(q),R8=(q)=>(R8=x.oc)(q),A9=(q,F)=>(A9=x.pc)(q,F),z9=()=>(z9=x.qc)(),Y0=(q,F)=>(Y0=x.rc)(q,F),n1=(q)=>(n1=x.sc)(q),$9=(q,F)=>($9=x.tc)(q,F),e=(q)=>(e=x.uc)(q),E8=(q)=>(E8=x.vc)(q),X0=()=>(X0=x.wc)(),P9=(q)=>(P9=x.xc)(q),S9=(q)=>(S9=x.yc)(q),Z9=(q,F,K)=>(Z9=x.zc)(q,F,K),w9=(q)=>(w9=x.Ac)(q),k9=Y.dynCall_iii=(q,F,K)=>(k9=Y.dynCall_iii=x.Bc)(q,F,K),C9=Y.dynCall_vi=(q,F)=>(C9=Y.dynCall_vi=x.Cc)(q,F),D8=Y.dynCall_ii=(q,F)=>(D8=Y.dynCall_ii=x.Dc)(q,F),I9=Y.dynCall_vii=(q,F,K)=>(I9=Y.dynCall_vii=x.Ec)(q,F,K),_9=Y.dynCall_iiii=(q,F,K,M)=>(_9=Y.dynCall_iiii=x.Fc)(q,F,K,M),b9=Y.dynCall_viii=(q,F,K,M)=>(b9=Y.dynCall_viii=x.Gc)(q,F,K,M),v9=Y.dynCall_iiiii=(q,F,K,M,O)=>(v9=Y.dynCall_iiiii=x.Hc)(q,F,K,M,O),T9=Y.dynCall_viiii=(q,F,K,M,O)=>(T9=Y.dynCall_viiii=x.Ic)(q,F,K,M,O),x9=Y.dynCall_viiiiii=(q,F,K,M,O,$,Z)=>(x9=Y.dynCall_viiiiii=x.Jc)(q,F,K,M,O,$,Z),f9=Y.dynCall_viiiiiii=(q,F,K,M,O,$,Z,_)=>(f9=Y.dynCall_viiiiiii=x.Kc)(q,F,K,M,O,$,Z,_),h9=Y.dynCall_ji=(q,F)=>(h9=Y.dynCall_ji=x.Lc)(q,F),y9=Y.dynCall_v=(q)=>(y9=Y.dynCall_v=x.Mc)(q),g9=Y.dynCall_viiiii=(q,F,K,M,O,$)=>(g9=Y.dynCall_viiiii=x.Nc)(q,F,K,M,O,$),l9=Y.dynCall_i=(q)=>(l9=Y.dynCall_i=x.Oc)(q),m9=Y.dynCall_fii=(q,F,K)=>(m9=Y.dynCall_fii=x.Pc)(q,F,K),p9=Y.dynCall_viiiiiiii=(q,F,K,M,O,$,Z,_,b)=>(p9=Y.dynCall_viiiiiiii=x.Qc)(q,F,K,M,O,$,Z,_,b),c9=Y.dynCall_viiiiiiiiii=(q,F,K,M,O,$,Z,_,b,y,c)=>(c9=Y.dynCall_viiiiiiiiii=x.Rc)(q,F,K,M,O,$,Z,_,b,y,c),d9=Y.dynCall_jiii=(q,F,K,M)=>(d9=Y.dynCall_jiii=x.Sc)(q,F,K,M),u9=Y.dynCall_dii=(q,F,K)=>(u9=Y.dynCall_dii=x.Tc)(q,F,K),o9=Y.dynCall_viiiiiiiii=(q,F,K,M,O,$,Z,_,b,y)=>(o9=Y.dynCall_viiiiiiiii=x.Uc)(q,F,K,M,O,$,Z,_,b,y),s9=Y.dynCall_viiiiiiiiiii=(q,F,K,M,O,$,Z,_,b,y,c,n)=>(s9=Y.dynCall_viiiiiiiiiii=x.Vc)(q,F,K,M,O,$,Z,_,b,y,c,n),a9=Y.dynCall_iiiiii=(q,F,K,M,O,$)=>(a9=Y.dynCall_iiiiii=x.Wc)(q,F,K,M,O,$),i9=Y.dynCall_iij=(q,F,K)=>(i9=Y.dynCall_iij=x.Xc)(q,F,K),n9=Y.dynCall_iiiiiiiiii=(q,F,K,M,O,$,Z,_,b,y)=>(n9=Y.dynCall_iiiiiiiiii=x.Yc)(q,F,K,M,O,$,Z,_,b,y),r9=Y.dynCall_iiiiiiiiiii=(q,F,K,M,O,$,Z,_,b,y,c)=>(r9=Y.dynCall_iiiiiiiiiii=x.Zc)(q,F,K,M,O,$,Z,_,b,y,c),t9=Y.dynCall_vij=(q,F,K)=>(t9=Y.dynCall_vij=x._c)(q,F,K),e9=Y.dynCall_iiif=(q,F,K,M)=>(e9=Y.dynCall_iiif=x.$c)(q,F,K,M),J2=Y.dynCall_iiij=(q,F,K,M)=>(J2=Y.dynCall_iiij=x.ad)(q,F,K,M),Q2=Y.dynCall_fiii=(q,F,K,M)=>(Q2=Y.dynCall_fiii=x.bd)(q,F,K,M),X2=Y.dynCall_viiiiiiiiiiiii=(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0)=>(X2=Y.dynCall_viiiiiiiiiiiii=x.cd)(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0),Y2=Y.dynCall_vjiii=(q,F,K,M,O)=>(Y2=Y.dynCall_vjiii=x.dd)(q,F,K,M,O),H2=Y.dynCall_vif=(q,F,K)=>(H2=Y.dynCall_vif=x.ed)(q,F,K),q2=Y.dynCall_iiiiiii=(q,F,K,M,O,$,Z)=>(q2=Y.dynCall_iiiiiii=x.fd)(q,F,K,M,O,$,Z),W2=Y.dynCall_iiiij=(q,F,K,M,O)=>(W2=Y.dynCall_iiiij=x.gd)(q,F,K,M,O),G2=Y.dynCall_iiiiiiii=(q,F,K,M,O,$,Z,_)=>(G2=Y.dynCall_iiiiiiii=x.hd)(q,F,K,M,O,$,Z,_),j2=Y.dynCall_viiiiiiiiiiii=(q,F,K,M,O,$,Z,_,b,y,c,n,H0)=>(j2=Y.dynCall_viiiiiiiiiiii=x.id)(q,F,K,M,O,$,Z,_,b,y,c,n,H0),F2=Y.dynCall_diii=(q,F,K,M)=>(F2=Y.dynCall_diii=x.jd)(q,F,K,M),N2=Y.dynCall_jiiii=(q,F,K,M,O)=>(N2=Y.dynCall_jiiii=x.kd)(q,F,K,M,O),V2=Y.dynCall_viiij=(q,F,K,M,O)=>(V2=Y.dynCall_viiij=x.ld)(q,F,K,M,O),K2=Y.dynCall_fiiii=(q,F,K,M,O)=>(K2=Y.dynCall_fiiii=x.md)(q,F,K,M,O),M2=Y.dynCall_viiif=(q,F,K,M,O)=>(M2=Y.dynCall_viiif=x.nd)(q,F,K,M,O),B2=Y.dynCall_diiii=(q,F,K,M,O)=>(B2=Y.dynCall_diiii=x.od)(q,F,K,M,O),L2=Y.dynCall_viiid=(q,F,K,M,O)=>(L2=Y.dynCall_viiid=x.pd)(q,F,K,M,O),U2=Y.dynCall_iiiijii=(q,F,K,M,O,$,Z)=>(U2=Y.dynCall_iiiijii=x.qd)(q,F,K,M,O,$,Z),O2=Y.dynCall_iiiiiij=(q,F,K,M,O,$,Z)=>(O2=Y.dynCall_iiiiiij=x.rd)(q,F,K,M,O,$,Z),R2=(q)=>(R2=x.sd)(q),E2=()=>(E2=x.td)(),D2=(q)=>(D2=x.ud)(q),A2=()=>(A2=x.vd)();function QQ(q,F,K){var M=X0();try{I9(q,F,K)}catch(O){if(e(M),O!==O+0)throw O;Y0(1,0)}}function XQ(q,F,K){var M=X0();try{return k9(q,F,K)}catch(O){if(e(M),O!==O+0)throw O;Y0(1,0)}}function YQ(q,F){var K=X0();try{C9(q,F)}catch(M){if(e(K),M!==M+0)throw M;Y0(1,0)}}function HQ(q,F){var K=X0();try{return D8(q,F)}catch(M){if(e(K),M!==M+0)throw M;Y0(1,0)}}function qQ(q,F,K,M){var O=X0();try{return _9(q,F,K,M)}catch($){if(e(O),$!==$+0)throw $;Y0(1,0)}}function WQ(q,F,K,M,O){var $=X0();try{T9(q,F,K,M,O)}catch(Z){if(e($),Z!==Z+0)throw Z;Y0(1,0)}}function GQ(q,F,K,M,O){var $=X0();try{return v9(q,F,K,M,O)}catch(Z){if(e($),Z!==Z+0)throw Z;Y0(1,0)}}function jQ(q,F,K,M){var O=X0();try{b9(q,F,K,M)}catch($){if(e(O),$!==$+0)throw $;Y0(1,0)}}function FQ(q,F,K,M,O,$,Z){var _=X0();try{return q2(q,F,K,M,O,$,Z)}catch(b){if(e(_),b!==b+0)throw b;Y0(1,0)}}function NQ(q){var F=X0();try{y9(q)}catch(K){if(e(F),K!==K+0)throw K;Y0(1,0)}}function VQ(q,F,K){var M=X0();try{return i9(q,F,K)}catch(O){if(e(M),O!==O+0)throw O;Y0(1,0)}}function KQ(q,F,K,M,O,$){var Z=X0();try{g9(q,F,K,M,O,$)}catch(_){if(e(Z),_!==_+0)throw _;Y0(1,0)}}function MQ(q,F,K){var M=X0();try{t9(q,F,K)}catch(O){if(e(M),O!==O+0)throw O;Y0(1,0)}}function BQ(q,F,K,M,O,$,Z){var _=X0();try{x9(q,F,K,M,O,$,Z)}catch(b){if(e(_),b!==b+0)throw b;Y0(1,0)}}function LQ(q,F,K,M,O,$,Z,_){var b=X0();try{f9(q,F,K,M,O,$,Z,_)}catch(y){if(e(b),y!==y+0)throw y;Y0(1,0)}}function UQ(q,F,K,M,O,$){var Z=X0();try{return a9(q,F,K,M,O,$)}catch(_){if(e(Z),_!==_+0)throw _;Y0(1,0)}}function OQ(q,F,K,M,O,$,Z,_){var b=X0();try{return G2(q,F,K,M,O,$,Z,_)}catch(y){if(e(b),y!==y+0)throw y;Y0(1,0)}}function RQ(q,F,K,M,O,$,Z,_,b,y){var c=X0();try{o9(q,F,K,M,O,$,Z,_,b,y)}catch(n){if(e(c),n!==n+0)throw n;Y0(1,0)}}function EQ(q,F,K,M,O,$,Z,_,b){var y=X0();try{p9(q,F,K,M,O,$,Z,_,b)}catch(c){if(e(y),c!==c+0)throw c;Y0(1,0)}}function DQ(q){var F=X0();try{return l9(q)}catch(K){if(e(F),K!==K+0)throw K;Y0(1,0)}}function AQ(q,F,K,M,O,$,Z,_,b,y){var c=X0();try{return n9(q,F,K,M,O,$,Z,_,b,y)}catch(n){if(e(c),n!==n+0)throw n;Y0(1,0)}}function zQ(q,F,K){var M=X0();try{return m9(q,F,K)}catch(O){if(e(M),O!==O+0)throw O;Y0(1,0)}}function $Q(q,F,K,M){var O=X0();try{return d9(q,F,K,M)}catch($){if(e(O),$!==$+0)throw $;return Y0(1,0),0n}}function PQ(q,F,K){var M=X0();try{return u9(q,F,K)}catch(O){if(e(M),O!==O+0)throw O;Y0(1,0)}}function SQ(q,F,K,M,O,$,Z,_,b,y,c,n){var H0=X0();try{s9(q,F,K,M,O,$,Z,_,b,y,c,n)}catch(D0){if(e(H0),D0!==D0+0)throw D0;Y0(1,0)}}function ZQ(q,F,K,M,O,$,Z,_,b,y,c){var n=X0();try{c9(q,F,K,M,O,$,Z,_,b,y,c)}catch(H0){if(e(n),H0!==H0+0)throw H0;Y0(1,0)}}function wQ(q,F,K,M,O,$,Z,_,b,y,c){var n=X0();try{return r9(q,F,K,M,O,$,Z,_,b,y,c)}catch(H0){if(e(n),H0!==H0+0)throw H0;Y0(1,0)}}function kQ(q,F,K,M){var O=X0();try{return e9(q,F,K,M)}catch($){if(e(O),$!==$+0)throw $;Y0(1,0)}}function CQ(q,F,K,M){var O=X0();try{return J2(q,F,K,M)}catch($){if(e(O),$!==$+0)throw $;Y0(1,0)}}function IQ(q,F,K,M){var O=X0();try{return Q2(q,F,K,M)}catch($){if(e(O),$!==$+0)throw $;Y0(1,0)}}function _Q(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0){var r0=X0();try{X2(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0)}catch(r1){if(e(r0),r1!==r1+0)throw r1;Y0(1,0)}}function bQ(q,F,K,M,O){var $=X0();try{Y2(q,F,K,M,O)}catch(Z){if(e($),Z!==Z+0)throw Z;Y0(1,0)}}function vQ(q,F,K){var M=X0();try{H2(q,F,K)}catch(O){if(e(M),O!==O+0)throw O;Y0(1,0)}}function TQ(q,F){var K=X0();try{return h9(q,F)}catch(M){if(e(K),M!==M+0)throw M;return Y0(1,0),0n}}function xQ(q,F,K,M,O){var $=X0();try{return W2(q,F,K,M,O)}catch(Z){if(e($),Z!==Z+0)throw Z;Y0(1,0)}}function fQ(q,F,K,M,O,$,Z,_,b,y,c,n,H0){var D0=X0();try{j2(q,F,K,M,O,$,Z,_,b,y,c,n,H0)}catch(r0){if(e(D0),r0!==r0+0)throw r0;Y0(1,0)}}function hQ(q,F,K,M){var O=X0();try{return F2(q,F,K,M)}catch($){if(e(O),$!==$+0)throw $;Y0(1,0)}}function yQ(q,F,K,M,O){var $=X0();try{return N2(q,F,K,M,O)}catch(Z){if(e($),Z!==Z+0)throw Z;return Y0(1,0),0n}}function gQ(q,F,K,M,O){var $=X0();try{V2(q,F,K,M,O)}catch(Z){if(e($),Z!==Z+0)throw Z;Y0(1,0)}}function lQ(q,F,K,M,O){var $=X0();try{return K2(q,F,K,M,O)}catch(Z){if(e($),Z!==Z+0)throw Z;Y0(1,0)}}function mQ(q,F,K,M,O){var $=X0();try{M2(q,F,K,M,O)}catch(Z){if(e($),Z!==Z+0)throw Z;Y0(1,0)}}function pQ(q,F,K,M,O){var $=X0();try{return B2(q,F,K,M,O)}catch(Z){if(e($),Z!==Z+0)throw Z;Y0(1,0)}}function cQ(q,F,K,M,O){var $=X0();try{L2(q,F,K,M,O)}catch(Z){if(e($),Z!==Z+0)throw Z;Y0(1,0)}}function dQ(q,F,K,M,O,$,Z){var _=X0();try{return U2(q,F,K,M,O,$,Z)}catch(b){if(e(_),b!==b+0)throw b;Y0(1,0)}}function uQ(q,F,K,M,O,$,Z){var _=X0();try{return O2(q,F,K,M,O,$,Z)}catch(b){if(e(_),b!==b+0)throw b;Y0(1,0)}}return Y.stackSave=()=>X0(),Y.stackRestore=(q)=>e(q),Y.stackAlloc=(q)=>E8(q),Y.setValue=function(q,F,K="i8"){switch(K.endsWith("*")&&(K="*"),K){case"i1":case"i8":s()[q>>>0]=F;break;case"i16":f()[q>>>1>>>0]=F;break;case"i32":v()[q>>>2>>>0]=F;break;case"i64":h[q>>>3]=BigInt(F);break;case"float":k0()[q>>>2>>>0]=F;break;case"double":o0()[q>>>3>>>0]=F;break;case"*":r()[q>>>2>>>0]=F;break;default:W1(`invalid type for setValue: ${K}`)}},Y.getValue=function(q,F="i8"){switch(F.endsWith("*")&&(F="*"),F){case"i1":case"i8":return s()[q>>>0];case"i16":return f()[q>>>1>>>0];case"i32":return v()[q>>>2>>>0];case"i64":return h[q>>>3];case"float":return k0()[q>>>2>>>0];case"double":return o0()[q>>>3>>>0];case"*":return r()[q>>>2>>>0];default:W1(`invalid type for getValue: ${F}`)}},Y.UTF8ToString=b0,Y.stringToUTF8=_1,Y.lengthBytesUTF8=b7,function q(){if(0<o1)s1=q;else if(j)Q(Y),D6();else{for(;0<Q8.length;)Q8.shift()(Y);0<o1?s1=q:(Y.calledRun=!0,G0||(D6(),Q(Y)))}}(),Y.PTR_SIZE=4,H}),bj=eQ,TH=globalThis.self?.name?.startsWith("em-pthread"),TH&&eQ()}),W3=J0(()=>{q3(),JX=typeof location>"u"?void 0:location.origin,xH=()=>{return import.meta.url?.startsWith("file:")?new URL(new URL("ort.webgpu.bundle.min.mjs",import.meta.url).href,JX).href:import.meta.url},v1=xH(),vj=()=>{if(v1&&!v1.startsWith("blob:"))return v1.substring(0,v1.lastIndexOf("/")+1)},$5=(J,Q)=>{try{let X=Q??v1;return(X?new URL(J,X):new URL(J)).origin===JX}catch{return!1}},fH=(J,Q)=>{let X=Q??v1;try{return(X?new URL(J,X):new URL(J)).href}catch{return}},hH=(J,Q)=>`${Q??"./"}${J}`,QX=async(J)=>{let Q=await(await fetch(J,{credentials:"same-origin"})).blob();return URL.createObjectURL(Q)},yH=async(J)=>(await import(J)).default,XX=(HD(),h5(Cj)).default,Tj=async()=>{if(!v1)throw Error("Failed to load proxy worker: cannot determine the script source URL.");if($5(v1))return[void 0,XX()];let J=await QX(v1);return[J,XX(J)]},YX=(qD(),h5(_j)).default,xj=async(J,Q,X)=>{if(!J&&!Q&&YX&&v1&&$5(v1))return[void 0,YX];{let Y="ort-wasm-simd-threaded.jsep.mjs",H=J??fH(Y,Q),W=X&&H&&!$5(H,Q),G=W?await QX(H):H??hH(Y,Q);return[W?G:void 0,await yH(G)]}}}),b8=J0(()=>{W3(),P5=!1,$2=!1,qX=!1,gH=()=>{if(typeof SharedArrayBuffer>"u")return!1;try{return typeof MessageChannel<"u"&&new MessageChannel().port1.postMessage(new SharedArrayBuffer(1)),WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,5,4,1,3,1,1,10,11,1,9,0,65,0,254,16,2,0,26,11]))}catch{return!1}},lH=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,30,1,28,0,65,0,253,15,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,253,186,1,26,11]))}catch{return!1}},G3=async(J)=>{if(P5)return Promise.resolve();if($2)throw Error("multiple calls to 'initializeWebAssembly()' detected.");if(qX)throw Error("previous call to 'initializeWebAssembly()' failed.");$2=!0;let{initTimeout:Q,numThreads:X}=J;if(!lH())throw Error("WebAssembly SIMD is not supported in the current environment.");let Y=gH();X>1&&!Y&&(typeof self<"u"&&!self.crossOriginIsolated&&console.warn("env.wasm.numThreads is set to "+X+", but this will not work unless you enable crossOriginIsolated mode. See https://web.dev/cross-origin-isolation-guide/ for more info."),console.warn("WebAssembly multi-threading is not supported in the current environment. Falling back to single-threading."),J.numThreads=X=1);let H=J.wasmPaths,W=typeof H=="string"?H:void 0,G=H?.mjs,j=G?.href??G,N=H?.wasm,V=N?.href??N,L=J.wasmBinary,[B,U]=await xj(j,W,X>1),E=!1,R=[];if(Q>0&&R.push(new Promise((A)=>{setTimeout(()=>{E=!0,A()},Q)})),R.push(new Promise((A,P)=>{let z={numThreads:X};if(L)z.wasmBinary=L;else if(V||W)z.locateFile=(D)=>V??W+D;else if(j&&j.indexOf("blob:")!==0)z.locateFile=(D)=>new URL(D,j).href;else if(B){let D=vj();D&&(z.locateFile=(S)=>D+S)}U(z).then((D)=>{$2=!1,P5=!0,HX=D,A(),B&&URL.revokeObjectURL(B)},(D)=>{$2=!1,qX=!0,P(D)})})),await Promise.race(R),E)throw Error(`WebAssembly backend initializing failed due to timeout: ${Q}ms`)},F1=()=>{if(P5&&HX)return HX;throw Error("WebAssembly is not initialized yet.")}}),j3=J0(()=>{b8(),D1=(J,Q)=>{let X=F1(),Y=X.lengthBytesUTF8(J)+1,H=X._malloc(Y);return X.stringToUTF8(J,H,Y),Q.push(H),H},y5=(J,Q,X,Y)=>{if(typeof J=="object"&&J!==null){if(X.has(J))throw Error("Circular reference in options");X.add(J)}Object.entries(J).forEach(([H,W])=>{let G=Q?Q+H:H;if(typeof W=="object")y5(W,G+".",X,Y);else if(typeof W=="string"||typeof W=="number")Y(G,W.toString());else if(typeof W=="boolean")Y(G,W?"1":"0");else throw Error(`Can't handle extra config type: ${typeof W}`)})},m0=(J)=>{let Q=F1(),X=Q.stackSave();try{let Y=Q.PTR_SIZE,H=Q.stackAlloc(2*Y);Q._OrtGetLastError(H,H+Y);let W=Number(Q.getValue(H,Y===4?"i32":"i64")),G=Q.getValue(H+Y,"*"),j=G?Q.UTF8ToString(G):"";throw Error(`${J} ERROR_CODE: ${W}, ERROR_MESSAGE: ${j}`)}finally{Q.stackRestore(X)}}}),WD=J0(()=>{b8(),j3(),fj=(J)=>{let Q=F1(),X=0,Y=[],H=J||{};try{if(J?.logSeverityLevel===void 0)H.logSeverityLevel=2;else if(typeof J.logSeverityLevel!="number"||!Number.isInteger(J.logSeverityLevel)||J.logSeverityLevel<0||J.logSeverityLevel>4)throw Error(`log serverity level is not valid: ${J.logSeverityLevel}`);if(J?.logVerbosityLevel===void 0)H.logVerbosityLevel=0;else if(typeof J.logVerbosityLevel!="number"||!Number.isInteger(J.logVerbosityLevel))throw Error(`log verbosity level is not valid: ${J.logVerbosityLevel}`);J?.terminate===void 0&&(H.terminate=!1);let W=0;return J?.tag!==void 0&&(W=D1(J.tag,Y)),X=Q._OrtCreateRunOptions(H.logSeverityLevel,H.logVerbosityLevel,!!H.terminate,W),X===0&&m0("Can't create run options."),J?.extra!==void 0&&y5(J.extra,"",new WeakSet,(G,j)=>{let N=D1(G,Y),V=D1(j,Y);Q._OrtAddRunConfigEntry(X,N,V)!==0&&m0(`Can't set a run config entry: ${G} - ${j}.`)}),[X,Y]}catch(W){throw X!==0&&Q._OrtReleaseRunOptions(X),Y.forEach((G)=>Q._free(G)),W}}}),GD=J0(()=>{b8(),j3(),mH=(J)=>{switch(J){case"disabled":return 0;case"basic":return 1;case"extended":return 2;case"all":return 99;default:throw Error(`unsupported graph optimization level: ${J}`)}},pH=(J)=>{switch(J){case"sequential":return 0;case"parallel":return 1;default:throw Error(`unsupported execution mode: ${J}`)}},cH=(J)=>{J.extra||(J.extra={}),J.extra.session||(J.extra.session={});let Q=J.extra.session;Q.use_ort_model_bytes_directly||(Q.use_ort_model_bytes_directly="1"),J.executionProviders&&J.executionProviders.some((X)=>(typeof X=="string"?X:X.name)==="webgpu")&&(J.enableMemPattern=!1)},dH=(J,Q,X)=>{for(let Y of Q){let H=typeof Y=="string"?Y:Y.name;switch(H){case"webnn":if(H="WEBNN",typeof Y!="string"){let G=Y?.deviceType;if(G){let j=D1("deviceType",X),N=D1(G,X);F1()._OrtAddSessionConfigEntry(J,j,N)!==0&&m0(`Can't set a session config entry: 'deviceType' - ${G}.`)}}break;case"webgpu":if(H="JS",typeof Y!="string"){let G=Y;if(G?.preferredLayout){if(G.preferredLayout!=="NCHW"&&G.preferredLayout!=="NHWC")throw Error(`preferredLayout must be either 'NCHW' or 'NHWC': ${G.preferredLayout}`);let j=D1("preferredLayout",X),N=D1(G.preferredLayout,X);F1()._OrtAddSessionConfigEntry(J,j,N)!==0&&m0(`Can't set a session config entry: 'preferredLayout' - ${G.preferredLayout}.`)}}break;case"wasm":case"cpu":continue;default:throw Error(`not supported execution provider: ${H}`)}let W=D1(H,X);F1()._OrtAppendExecutionProvider(J,W)!==0&&m0(`Can't append execution provider: ${H}.`)}},hj=(J)=>{let Q=F1(),X=0,Y=[],H=J||{};cH(H);try{let W=mH(H.graphOptimizationLevel??"all"),G=pH(H.executionMode??"sequential"),j=typeof H.logId=="string"?D1(H.logId,Y):0,N=H.logSeverityLevel??2;if(!Number.isInteger(N)||N<0||N>4)throw Error(`log serverity level is not valid: ${N}`);let V=H.logVerbosityLevel??0;if(!Number.isInteger(V)||V<0||V>4)throw Error(`log verbosity level is not valid: ${V}`);let L=typeof H.optimizedModelFilePath=="string"?D1(H.optimizedModelFilePath,Y):0;if(X=Q._OrtCreateSessionOptions(W,!!H.enableCpuMemArena,!!H.enableMemPattern,G,!!H.enableProfiling,0,j,N,V,L),X===0&&m0("Can't create session options."),H.executionProviders&&dH(X,H.executionProviders,Y),H.enableGraphCapture!==void 0){if(typeof H.enableGraphCapture!="boolean")throw Error(`enableGraphCapture must be a boolean value: ${H.enableGraphCapture}`);let B=D1("enableGraphCapture",Y),U=D1(H.enableGraphCapture.toString(),Y);Q._OrtAddSessionConfigEntry(X,B,U)!==0&&m0(`Can't set a session config entry: 'enableGraphCapture' - ${H.enableGraphCapture}.`)}if(H.freeDimensionOverrides)for(let[B,U]of Object.entries(H.freeDimensionOverrides)){if(typeof B!="string")throw Error(`free dimension override name must be a string: ${B}`);if(typeof U!="number"||!Number.isInteger(U)||U<0)throw Error(`free dimension override value must be a non-negative integer: ${U}`);let E=D1(B,Y);Q._OrtAddFreeDimensionOverride(X,E,U)!==0&&m0(`Can't set a free dimension override: ${B} - ${U}.`)}return H.extra!==void 0&&y5(H.extra,"",new WeakSet,(B,U)=>{let E=D1(B,Y),R=D1(U,Y);Q._OrtAddSessionConfigEntry(X,E,R)!==0&&m0(`Can't set a session config entry: ${B} - ${U}.`)}),[X,Y]}catch(W){throw X!==0&&Q._OrtReleaseSessionOptions(X)!==0&&m0("Can't release session options."),Y.forEach((G)=>Q._free(G)),W}}}),A0=J0(()=>{t8=(J)=>{switch(J){case"int8":return 3;case"uint8":return 2;case"bool":return 9;case"int16":return 5;case"uint16":return 4;case"int32":return 6;case"uint32":return 12;case"float16":return 10;case"float32":return 1;case"float64":return 11;case"string":return 8;case"int64":return 7;case"uint64":return 13;case"int4":return 22;case"uint4":return 21;default:throw Error(`unsupported data type: ${J}`)}},Z8=(J)=>{switch(J){case 3:return"int8";case 2:return"uint8";case 9:return"bool";case 5:return"int16";case 4:return"uint16";case 6:return"int32";case 12:return"uint32";case 10:return"float16";case 1:return"float32";case 11:return"float64";case 8:return"string";case 7:return"int64";case 13:return"uint64";case 22:return"int4";case 21:return"uint4";default:throw Error(`unsupported data type: ${J}`)}},w8=(J,Q)=>{let X=[-1,4,1,1,2,2,4,8,-1,1,2,8,4,8,-1,-1,-1,-1,-1,-1,-1,0.5,0.5][J],Y=typeof Q=="number"?Q:Q.reduce((H,W)=>H*W,1);return X>0?Math.ceil(Y*X):void 0},F3=(J)=>{switch(J){case"float16":return typeof Float16Array<"u"&&Float16Array.from?Float16Array:Uint16Array;case"float32":return Float32Array;case"uint8":return Uint8Array;case"int8":return Int8Array;case"uint16":return Uint16Array;case"int16":return Int16Array;case"int32":return Int32Array;case"bool":return Uint8Array;case"float64":return Float64Array;case"uint32":return Uint32Array;case"int64":return BigInt64Array;case"uint64":return BigUint64Array;default:throw Error(`unsupported type: ${J}`)}},g5=(J)=>{switch(J){case"verbose":return 0;case"info":return 1;case"warning":return 2;case"error":return 3;case"fatal":return 4;default:throw Error(`unsupported logging level: ${J}`)}},N3=(J)=>J==="float32"||J==="float16"||J==="int32"||J==="int64"||J==="uint32"||J==="uint8"||J==="bool"||J==="uint4"||J==="int4",V3=(J)=>J==="float32"||J==="float16"||J==="int32"||J==="int64"||J==="uint32"||J==="uint64"||J==="int8"||J==="uint8"||J==="bool"||J==="uint4"||J==="int4",pX=(J)=>{switch(J){case"none":return 0;case"cpu":return 1;case"cpu-pinned":return 2;case"texture":return 3;case"gpu-buffer":return 4;case"ml-tensor":return 5;default:throw Error(`unsupported data location: ${J}`)}}}),yj=J0(()=>{q3(),K3=async(J)=>{if(typeof J=="string"){let Q=await fetch(J);if(!Q.ok)throw Error(`failed to load external data file: ${J}`);let X=Q.headers.get("Content-Length"),Y=X?parseInt(X,10):0;if(Y<1073741824)return new Uint8Array(await Q.arrayBuffer());{if(!Q.body)throw Error(`failed to load external data file: ${J}, no response body.`);let H=Q.body.getReader(),W;try{W=new ArrayBuffer(Y)}catch(j){if(j instanceof RangeError){let N=Math.ceil(Y/65536);W=new WebAssembly.Memory({initial:N,maximum:N}).buffer}else throw j}let G=0;for(;;){let{done:j,value:N}=await H.read();if(j)break;let V=N.byteLength;new Uint8Array(W,G,V).set(N),G+=V}return new Uint8Array(W,0,Y)}}else return J instanceof Blob?new Uint8Array(await J.arrayBuffer()):J instanceof Uint8Array?J:new Uint8Array(J)}}),x6=J0(()=>{A0(),uH=["V","I","W","E","F"],oH=(J,Q)=>{console.log(`[${uH[J]},${new Date().toISOString()}]${Q}`)},M3=(J,Q)=>{sH=J,aH=Q},iH=(J,Q)=>{let X=g5(J),Y=g5(sH);X>=Y&&oH(X,typeof Q=="function"?Q():Q)},x0=(...J)=>{aH&&iH(...J)}}),gj=J0(()=>{A0(),B3=(J,Q)=>new(F3(Q))(J)}),L3=J0(()=>{}),jD=J0(()=>{x6(),L3(),WX=new Map([[64,250],[128,200],[256,200],[512,200],[2048,230],[4096,200],[8192,50],[16384,50],[32768,50],[65536,50],[131072,50],[262144,50],[524288,50],[1048576,50],[2097152,30],[4194304,20],[8388608,10],[12582912,10],[16777216,10],[26214400,15],[33554432,22],[44236800,2],[58982400,6],[67108864,6],[134217728,6],[167772160,6]]),S5=[],Z5=(J)=>Math.ceil(Number(J)/16)*16,nH=(J)=>{for(let Q=0;Q<S5.length;Q++){let X=S5[Q];if(J<=X)return X}return Math.ceil(J/16)*16},rH=1,GX=()=>rH++,cX=async(J,Q,X,Y)=>{let H=Z5(X),W=J.device.createBuffer({size:H,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});try{let G=J.getCommandEncoder();J.endComputePass(),G.copyBufferToBuffer(Q,0,W,0,H),J.flush(),await W.mapAsync(GPUMapMode.READ);let j=W.getMappedRange();if(Y){let N=Y();return N.set(new Uint8Array(j,0,X)),N}else return new Uint8Array(j.slice(0,X))}finally{W.destroy()}},tH=class{constructor(J){this.backend=J,this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.buffersPending=[],this.capturedPendingBuffers=new Map;for(let[Q]of WX)S5.push(Q),this.freeBuffers.set(Q,[]),this.freeUniformBuffers.set(Q,[]);this.sessionCount=0}upload(J,Q){let{buffer:X,byteOffset:Y,byteLength:H}=Q,W=Z5(H),G=this.storageCache.get(J);if(!G)throw Error("gpu data for uploading does not exist");if(Number(G.originalSize)!==H)throw Error(`inconsistent data size. gpu data size=${G.originalSize}, data size=${H}`);let j=this.backend.device.createBuffer({mappedAtCreation:!0,size:W,usage:GPUBufferUsage.MAP_WRITE|GPUBufferUsage.COPY_SRC}),N=j.getMappedRange();new Uint8Array(N).set(new Uint8Array(X,Y,H)),j.unmap();let V=this.backend.device.createCommandEncoder();V.copyBufferToBuffer(j,0,G.gpuData.buffer,0,W),this.backend.device.queue.submit([V.finish()]),j.destroy(),x0("verbose",()=>`[WebGPU] GpuDataManager.upload(id=${J})`)}memcpy(J,Q){let X=this.storageCache.get(J);if(!X)throw Error("source gpu data for memcpy does not exist");let Y=this.storageCache.get(Q);if(!Y)throw Error("destination gpu data for memcpy does not exist");if(X.originalSize!==Y.originalSize)throw Error("inconsistent source and destination gpu data size");let H=Z5(X.originalSize),W=this.backend.getCommandEncoder();this.backend.endComputePass(),W.copyBufferToBuffer(X.gpuData.buffer,0,Y.gpuData.buffer,0,H)}registerExternalBuffer(J,Q,X){let Y;if(X){if(Y=X[0],J===X[1])return x0("verbose",()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${Q}) => id=${Y}, buffer is the same, skip.`),Y;if(this.backend.capturedCommandList.has(this.backend.currentSessionId))throw Error(`Registering a different external buffer under graph capture mode is not supported yet.
             Please use the previous external buffer!`)}else Y=GX();return this.storageCache.set(Y,{gpuData:{id:Y,type:0,buffer:J},originalSize:Q}),x0("verbose",()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${Q}) => id=${Y}, registered.`),Y}unregisterExternalBuffer(J){J!==void 0&&(this.storageCache.delete(J),x0("verbose",()=>`[WebGPU] GpuDataManager.unregisterExternalBuffer() => id=${J}`))}create(J,Q=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST){let X=nH(J),Y,H=(Q&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE,W=(Q&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM;if(H||W){let j=(H?this.freeBuffers:this.freeUniformBuffers).get(X);j?j.length>0?Y=j.pop():Y=this.backend.device.createBuffer({size:X,usage:Q}):Y=this.backend.device.createBuffer({size:X,usage:Q})}else Y=this.backend.device.createBuffer({size:X,usage:Q});let G={id:GX(),type:0,buffer:Y};return this.storageCache.set(G.id,{gpuData:G,originalSize:Number(J)}),x0("verbose",()=>`[WebGPU] GpuDataManager.create(size=${J}) => id=${G.id}`),G}get(J){return this.storageCache.get(J)?.gpuData}release(J){let Q=typeof J=="bigint"?Number(J):J,X=this.storageCache.get(Q);if(!X){if(this.storageCache.size===0)return 0;throw Error("releasing data does not exist")}return x0("verbose",()=>`[WebGPU] GpuDataManager.release(id=${Q}), gpuDataId=${X.gpuData.id}`),this.storageCache.delete(Q),this.buffersPending.push(X.gpuData.buffer),X.originalSize}async download(J,Q){let X=this.storageCache.get(Number(J));if(!X)throw Error("data does not exist");await cX(this.backend,X.gpuData.buffer,X.originalSize,Q)}refreshPendingBuffers(){if(this.buffersPending.length!==0)if(this.backend.sessionStatus==="default"){for(let J of this.buffersPending){let Q=WX.get(J.size);if((J.usage&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE){let X=this.freeBuffers.get(J.size)||[];Q===void 0||X.length>=Q?J.destroy():X.push(J)}else if((J.usage&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM){let X=this.freeUniformBuffers.get(J.size)||[];Q===void 0||X.length>=Q?J.destroy():X.push(J)}else J.destroy()}this.buffersPending=[]}else{let J=this.capturedPendingBuffers.get(this.backend.currentSessionId);J||(J=[],this.capturedPendingBuffers.set(this.backend.currentSessionId,J));for(let Q of this.buffersPending)J.push(Q);this.buffersPending=[]}}dispose(){this.freeBuffers.forEach((J)=>{J.forEach((Q)=>{Q.destroy()})}),this.freeUniformBuffers.forEach((J)=>{J.forEach((Q)=>{Q.destroy()})}),this.storageCache.forEach((J)=>{J.gpuData.buffer.destroy()}),this.capturedPendingBuffers.forEach((J)=>{J.forEach((Q)=>{Q.destroy()})}),this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.capturedPendingBuffers=new Map}onCreateSession(){this.sessionCount+=1}onReleaseSession(J){let Q=this.capturedPendingBuffers.get(J);Q&&(Q.forEach((X)=>{X.destroy()}),this.capturedPendingBuffers.delete(J)),this.sessionCount-=1,this.sessionCount===0&&(x0("warning",()=>"[WebGPU] Clearing webgpu buffer cache"),this.storageCache.forEach((X)=>{X.gpuData.buffer.destroy()}),this.storageCache=new Map)}},lj=(...J)=>new tH(...J)}),J1=J0(()=>{eH=class{constructor(J){Object.assign(this,J)}get cacheKey(){return this.key||(this.key=Object.getOwnPropertyNames(this).sort().map((J)=>`${this[J]}`).join(";")),this.key}},c0=(J)=>new eH(J)}),Z0=J0(()=>{Jq=class{static calcMatMulShape(J,Q){return J[1]!==Q[0]?void 0:[J[0],Q[1]]}},J7=class{static calcShape(J,Q,X=!1){let Y=J.length,H=Q.length;if(Y===0)return Q;if(H===0)return J;let W=Math.max(J.length,Q.length),G=Array(W);if(X){if(Y<2||H<2)return;let j=Jq.calcMatMulShape([J[Y-2],J[Y-1]],[Q[H-2],Q[H-1]]);if(j===void 0)return;[G[W-2],G[W-1]]=j}for(let j=X?3:1;j<=W;j++){let N=Y-j<0?1:J[Y-j],V=H-j<0?1:Q[H-j];if(N!==V&&N>1&&V>1)return;let L=Math.max(N,V);if(N&&V)G[W-j]=Math.max(N,V);else{if(L>1)return;G[W-j]=0}}return G}static isValidBroadcast(J,Q){let X=J.length,Y=Q.length;if(X>Y)return!1;for(let H=1;H<=X;H++)if(J[X-H]!==1&&J[X-H]!==Q[Y-H])return!1;return!0}},d=class J{static size(Q){return J.getSizeFromDimensionRange(Q,0,Q.length)}static convertShape(Q,X=4){let Y=Q.length;if(Y===0)return[];let H=Array(Y),W=Y-1;for(;W>=0;){if(Q[W]%X===0){H[W]=Q[W]/X;break}if(X%Q[W]!==0)throw Error("cannot convert shape");H[W]=1,X/=Q[W],W--}for(W--;W>=0;W--)H[W]=Q[W];return H}static sizeFromDimension(Q,X){if(X<0||X>Q.length)throw Error(`invalid dimension of ${X} for sizeFromDimension as Tensor has ${Q.length} dimensions.`);return J.getSizeFromDimensionRange(Q,X,Q.length)}static sizeToDimension(Q,X){if(X<0||X>Q.length)throw Error(`invalid dimension of ${X} for sizeToDimension as Tensor has ${Q.length} dimensions.`);return J.getSizeFromDimensionRange(Q,0,X)}static getSizeFromDimensionRange(Q,X,Y){let H=1;for(let W=X;W<Y;W++){if(Q[W]<0)throw Error("cannot get valid size from specified dimension range. Most likely the range contains negative values in them.");H*=Number(Q[W])}return H}static computeStrides(Q){let X=Q.length;if(X===0)return[];if(X===1)return[1];let Y=Array(X);Y[X-1]=1,Y[X-2]=Q[X-1];for(let H=X-3;H>=0;--H)Y[H]=Y[H+1]*Q[H+1];return Y}static normalizeAxis(Q,X){if(Q<-X&&Q>=X)throw Error("unsupported axis for this operation.");return Q<0?Q+X:Q}static normalizeAxes(Q,X){return Q.map((Y)=>this.normalizeAxis(Y,X??Q.length))}static sortBasedOnPerm(Q,X){return X?X.map((Y)=>Q[Y]):Q.slice().reverse()}static padShape(Q,X){let Y=Q.length;return Q.map((H,W)=>H+X[W]+X[W+Y])}static areEqual(Q,X){return Q.length!==X.length?!1:Q.every((Y,H)=>Y===X[H])}},l5=class J{static adjustPoolAttributes(Q,X,Y,H,W,G){if(!Q&&Y.length!==X.length-2)throw Error("length of specified kernel shapes should be 2 less than length of input dimensions");if(Q)for(let j=0;j<X.length-2;j++)j>=Y.length?Y.push(X[j+2]):Y[j]=X[j+2];for(let j=0;j<Y.length;j++)if(j<H.length){if(H[j]<0)throw Error("strides should be greater than or equal to 1")}else H.push(1);for(let j=0;j<Y.length;j++)if(j<W.length){if(W[j]<0)throw Error("dilations should be greater than or equal to 1")}else W.push(1);for(let j=0;j<Y.length*2;j++)if(j<G.length){if(G[j]<0)throw Error("pad should be greater than or equal to 1")}else G.push(0);for(let j=0;j<Y.length;j++){if(Y[j]<=0)throw Error("kernel shapes need to be greater than 0");if(G[j]>=Y[j]||G[j+Y.length]>=Y[j])throw Error("pads should be smaller than kernel")}}static adjustPadsBasedOnAutoPad(Q,X,Y,H,W,G,j){if(j){if(W.length!==2*(Q.length-2))throw Error("length of pads should be twice the length of data dimensions");if(X.length!==Q.length-2)throw Error("length of strides should be the length of data dimensions");if(H.length!==Q.length-2)throw Error("length of kernel shapes should be the length of data dimensions");for(let N=0;N<Q.length-2;N++)J.adjustPadAndReturnShape(Q[N+(G?1:2)],X[N],Y[N],H[N],W,N,N+Q.length-2,j)}}static computePoolOutputShape(Q,X,Y,H,W,G,j){if(X.length<=0)throw Error("input shape must be of size greater than 0");let N=[X[0],X[1]];return J.computeShapeHelper(Q,X,N,Y,H,W,G,j),N}static computeConvOutputShape(Q,X,Y,H,W,G,j){if(Q.length<=0||X.length<=0)throw Error("invalid input tensor dims or invalid filter tensor dims");let N=[Q[0],X[0]];return J.computeShapeHelper(!1,Q,N,Y,H,W,G,j),N}static computeShapeHelper(Q,X,Y,H,W,G,j,N){if(Q)for(let V=0;V<X.length-2;V++)Y.push(1);else for(let V=0;V<X.length-2;V++)Y.push(J.adjustPadAndReturnShape(X[V+2],H[V],W[V],G[V],j,V,V+X.length-2,N))}static adjustPadAndReturnShape(Q,X,Y,H,W,G,j,N){let V=Y*(H-1)+1;if(N&&N!=="NOTSET")switch(N){case"VALID":return W[G]=0,W[j]=0,Math.floor((Q-V)/X+1);case"SAME_LOWER":case"SAME_UPPER":if(Y!==1)throw Error("Dilation not supported for SAME_UPPER or SAME_LOWER");{let L=((Q+X-1)/X-1)*X+H-Q;return W[G]=Math.floor(N==="SAME_LOWER"?(L+1)/2:L/2),W[j]=L-W[G],Math.floor((Q+L-H)/X+1)}default:throw Error("Unsupported AutoPad type")}else return Math.floor((Q+W[G]+W[j]-V)/X+1)}},mj=class{static getShapeOfGemmResult(J,Q,X,Y,H){if(J.length!==2||X.length!==2)throw Error("shape need to be of size 2");let W,G,j;Q?(W=J[1],G=J[0]):(W=J[0],G=J[1]);let N=-1;if(Y?(j=X[0],N=1):(j=X[1],N=0),X[N]!==G)throw Error("dimension mismatch");if(W<=0||j<=0||G<=0)throw Error("invalid shape specified");if(H&&!J7.isValidBroadcast(H,[W,j]))throw Error("gemm: invalid bias shape for broadcast");return[W,j,G]}},pj=-340282346638528860000000000000000000000,cj=340282346638528860000000000000000000000}),C0=J0(()=>{A0(),Z0(),Q7=64,w5=(J,Q)=>{if(Q===3)throw Error("vec3 has same alignment as vec4, use vec4 instead");switch(Number(J)){case 10:return Q>1?`vec${Q}<f16>`:"f16";case 1:return Q>1?`vec${Q}<f32>`:"f32";case 6:return Q>1?`vec${Q}<i32>`:"i32";case 12:return Q>1?`vec${Q}<u32>`:"u32";case 7:if(Q>1)throw Error("currently not supported vecX of uint64 yet");return["vec2<u32>","i32"];case 13:if(Q>1)throw Error("currently not supported vecX of uint64 yet");return["vec2<u32>","u32"];case 9:if(Q!==4)throw Error("bool must be vec4");return["u32","vec4<bool>"];case 22:return"i32";case 21:return"u32";default:throw Error(`Unknown data type: ${J}`)}},N1=(J,Q=1)=>{let X=w5(J,Q);return typeof X=="string"?X:X[0]},$1=(J,Q=1)=>{let X=w5(J,Q);return typeof X=="string"?X:X[1]},O0=(...J)=>{let Q=[];return J.forEach((X)=>{X.length!==0&&Q.push({type:12,data:X},{type:12,data:d.computeStrides(X)})}),Q},t0=(J)=>J%4===0?4:J%2===0?2:1,dX=(J="f32",Q,X="0")=>!Q||Q===1?`${J}(${X})`:`vec${Q}<${J}>(${X})`,e8=(J,Q,X)=>J==="f32"?X:Q===1?`f32(${X})`:`vec${Q}<f32>(${X})`,d6=(J,Q)=>Q===4?`(${J}.x + ${J}.y + ${J}.z + ${J}.w)`:Q===2?`(${J}.x + ${J}.y)`:Q===3?`(${J}.x + ${J}.y + ${J}.z)`:J,L0=(J,Q,X,Y)=>J.startsWith("uniforms.")&&X>4?typeof Q=="string"?Y==="f16"?`${J}[(${Q}) / 8][(${Q}) % 8 / 4][(${Q}) % 8 % 4]`:`${J}[(${Q}) / 4][(${Q}) % 4]`:Y==="f16"?`${J}[${Math.floor(Q/8)}][${Math.floor(Q%8/4)}][${Q%8%4}]`:`${J}[${Math.floor(Q/4)}][${Q%4}]`:X>1?`${J}[${Q}]`:J,P2=(J,Q,X,Y,H)=>{let W=typeof X=="number",G=W?X:X.length,j=[...Array(G).keys()],N=G<2?"u32":G<=4?`vec${G}<u32>`:`array<u32, ${G}>`,V=w5(Q,H),L=typeof V=="string"?V:V[1],B=typeof V=="string"?V:V[0],U={indices:N,value:L,storage:B,tensor:Q},E=(f)=>typeof f=="string"?f:`${f}u`,R={offsetToIndices:!1,indicesToOffset:!1,broadcastedIndicesToOffset:!1,set:!1,setByIndices:!1,get:!1,getByIndices:!1},A=W?"uniforms.":"",P=`${A}${J}_shape`,z=`${A}${J}_strides`,D="";for(let f=0;f<G-1;f++)D+=`
    let dim${f} = current / ${L0(z,f,G)};
    let rest${f} = current % ${L0(z,f,G)};
    indices[${f}] = dim${f};
    current = rest${f};
    `;D+=`indices[${G-1}] = current;`;let S=G<2?"":`
  fn o2i_${J}(offset: u32) -> ${U.indices} {
    var indices: ${U.indices};
    var current = offset;
    ${D}
    return indices;
  }`,w=(f)=>(R.offsetToIndices=!0,G<2?f:`o2i_${J}(${f})`),k=[];if(G>=2)for(let f=G-1;f>=0;f--)k.push(`${L0(z,f,G)} * (indices[${f}])`);let I=G<2?"":`
  fn i2o_${J}(indices: ${U.indices}) -> u32 {
    return ${k.join("+")};
  }`,C=(f)=>(R.indicesToOffset=!0,G<2?f:`i2o_${J}(${f})`),T=(...f)=>G===0?"0u":`${U.indices}(${f.map(E).join(",")})`,g=(f,p)=>G<2?`${f}`:`${L0(f,p,G)}`,m=(f,p,v)=>G<2?`${f}=${v};`:`${L0(f,p,G)}=${v};`,l={},t=(f,p)=>{R.broadcastedIndicesToOffset=!0;let v=`${p.name}broadcastedIndicesTo${J}Offset`;if(v in l)return`${v}(${f})`;let r=[];for(let k0=G-1;k0>=0;k0--){let o0=p.indicesGet("outputIndices",k0+p.rank-G);r.push(`${g(z,k0)} * (${o0} % ${g(P,k0)})`)}return l[v]=`fn ${v}(outputIndices: ${p.type.indices}) -> u32 {
             return ${r.length>0?r.join("+"):"0u"};
           }`,`${v}(${f})`},h=(f,p)=>(()=>{if(U.storage===U.value)return`${J}[${f}]=${p};`;if(U.storage==="vec2<u32>"&&U.value==="i32")return`${J}[${f}]=vec2<u32>(u32(${p}), select(0u, 0xFFFFFFFFu, ${p} < 0));`;if(U.storage==="vec2<u32>"&&U.value==="u32")return`${J}[${f}]=vec2<u32>(u32(${p}), 0u);`;if(U.storage==="u32"&&U.value==="vec4<bool>")return`${J}[${f}]=dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(${p}));`;throw Error(`not supported combination of storage type ${U.storage} and value type ${U.value} yet`)})(),W0=(f)=>(()=>{if(U.storage===U.value)return`${J}[${f}]`;if(U.storage==="vec2<u32>"&&U.value==="i32")return`i32(${J}[${f}].x)`;if(U.storage==="vec2<u32>"&&U.value==="u32")return`u32(${J}[${f}].x)`;if(U.storage==="u32"&&U.value==="vec4<bool>")return`vec4<bool>(bool(${J}[${f}] & 0xFFu), bool(${J}[${f}] & 0xFF00u), bool(${J}[${f}] & 0xFF0000u), bool(${J}[${f}] & 0xFF000000u))`;throw Error(`not supported combination of storage type ${U.storage} and value type ${U.value} yet`)})(),j0=G<2?"":`
  fn get_${J}ByIndices(indices: ${U.indices}) -> ${L} {
    return ${W0(`i2o_${J}(indices)`)};
  }`,o=G<2?"":(()=>{let f=j.map((v)=>`d${v}: u32`).join(", "),p=j.map((v)=>`d${v}`).join(", ");return`
  fn get_${J}(${f}) -> ${L} {
    return get_${J}ByIndices(${T(p)});
  }`})(),G0=(...f)=>{if(f.length!==G)throw Error(`indices length must be ${G}`);let p=f.map(E).join(",");return G===0?W0("0u"):G===1?W0(p[0]):(R.get=!0,R.getByIndices=!0,R.indicesToOffset=!0,`get_${J}(${p})`)},F0=(f)=>G<2?W0(f):(R.getByIndices=!0,R.indicesToOffset=!0,`get_${J}ByIndices(${f})`),s=G<2?"":`
  fn set_${J}ByIndices(indices: ${U.indices}, value: ${L}) {
    ${h(`i2o_${J}(indices)`,"value")}
  }`,N0=G<2?"":(()=>{let f=j.map((v)=>`d${v}: u32`).join(", "),p=j.map((v)=>`d${v}`).join(", ");return`
  fn set_${J}(${f}, value: ${L}) {
    set_${J}ByIndices(${T(p)}, value);
  }`})();return{impl:()=>{let f=[],p=!1;return R.offsetToIndices&&(f.push(S),p=!0),R.indicesToOffset&&(f.push(I),p=!0),R.broadcastedIndicesToOffset&&(Object.values(l).forEach((v)=>f.push(v)),p=!0),R.set&&(f.push(N0),p=!0),R.setByIndices&&(f.push(s),p=!0),R.get&&(f.push(o),p=!0),R.getByIndices&&(f.push(j0),p=!0),!W&&p&&f.unshift(`const ${P} = ${U.indices}(${X.join(",")});`,`const ${z} = ${U.indices}(${d.computeStrides(X).join(",")});`),f.join(`
`)},type:U,offsetToIndices:w,indicesToOffset:C,broadcastedIndicesToOffset:t,indices:T,indicesGet:g,indicesSet:m,set:(...f)=>{if(f.length!==G+1)throw Error(`indices length must be ${G}`);let p=f[G];if(typeof p!="string")throw Error("value must be string");let v=f.slice(0,G).map(E).join(",");return G===0?h("0u",p):G===1?h(v[0],p):(R.set=!0,R.setByIndices=!0,R.indicesToOffset=!0,`set_${J}(${v}, ${p})`)},setByOffset:h,setByIndices:(f,p)=>G<2?h(f,p):(R.setByIndices=!0,R.indicesToOffset=!0,`set_${J}ByIndices(${f}, ${p});`),get:G0,getByOffset:W0,getByIndices:F0,usage:Y,name:J,strides:z,shape:P,rank:G}},a=(J,Q,X,Y=1)=>P2(J,Q,X,"input",Y),M0=(J,Q,X,Y=1)=>P2(J,Q,X,"output",Y),dj=(J,Q,X)=>P2(J,Q,X,"atomicOutput",1),U3=(J,Q,X,Y=1)=>P2(J,Q,X,"internal",Y),Qq=class{constructor(J,Q){this.normalizedDispatchGroup=J,this.limits=Q,this.internalVariables=[],this.variables=[],this.uniforms=[],this.variableIndex=0}guardAgainstOutOfBoundsWorkgroupSizes(J){return`if (global_idx >= ${typeof J=="number"?`${J}u`:J}) { return; }`}mainStart(J=Q7){let Q=typeof J=="number"?J:J[0],X=typeof J=="number"?1:J[1],Y=typeof J=="number"?1:J[2];if(Q>this.limits.maxComputeWorkgroupSizeX||X>this.limits.maxComputeWorkgroupSizeY||Y>this.limits.maxComputeWorkgroupSizeZ)throw Error(`workgroup size [${Q}, ${X}, ${Y}] exceeds the maximum workgroup size [${this.limits.maxComputeWorkgroupSizeX}, ${this.limits.maxComputeWorkgroupSizeY}, ${this.limits.maxComputeWorkgroupSizeZ}].`);if(Q*X*Y>this.limits.maxComputeInvocationsPerWorkgroup)throw Error(`workgroup size [${Q}, ${X}, ${Y}] exceeds the maximum workgroup invocations ${this.limits.maxComputeInvocationsPerWorkgroup}.`);let H=this.normalizedDispatchGroup[1]===1&&this.normalizedDispatchGroup[2]===1,W=H?`@builtin(global_invocation_id) global_id : vec3<u32>,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(local_invocation_id) local_id : vec3<u32>`:`@builtin(global_invocation_id) global_id : vec3<u32>,
                                             @builtin(local_invocation_id) local_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(num_workgroups) num_workgroups : vec3<u32>`,G=H?`let global_idx = global_id.x;
         let workgroup_index = workgroup_id.x;`:`let workgroup_index = workgroup_id.z * num_workgroups[0] * num_workgroups[1] +
             workgroup_id.y * num_workgroups[0] + workgroup_id.x;
         let global_idx = workgroup_index * ${Q*X*Y}u + local_idx;`;return`@compute @workgroup_size(${Q}, ${X}, ${Y})
  fn main(${W}) {
    ${G}
  `}appendVariableUniforms(J){J.rank!==0&&(J.shape.startsWith("uniforms.")&&this.uniforms.push({name:J.shape.replace("uniforms.",""),type:"u32",length:J.rank}),J.strides.startsWith("uniforms.")&&this.uniforms.push({name:J.strides.replace("uniforms.",""),type:"u32",length:J.rank}))}declareVariable(J,Q){if(J.usage==="internal")throw Error("cannot use internal variable with declareVariable(). use registerInternalVariables() instead.");this.variables.push(J),this.appendVariableUniforms(J);let X=J.usage==="input"?"read":"read_write",Y=J.usage==="atomicOutput"?"atomic<i32>":J.type.storage;return`@group(0) @binding(${Q}) var<storage, ${X}> ${J.name}: array<${Y}>;`}declareVariables(...J){return J.map((Q)=>this.declareVariable(Q,this.variableIndex++)).join(`
`)}registerInternalVariable(J){if(J.usage!=="internal")throw Error("cannot use input or output variable with registerInternalVariable(). use declareVariables() instead.");this.internalVariables.push(J),this.appendVariableUniforms(J)}registerInternalVariables(...J){return J.forEach((Q)=>this.registerInternalVariable(Q)),this}registerUniform(J,Q,X=1){return this.uniforms.push({name:J,type:Q,length:X}),this}registerUniforms(J){return this.uniforms=this.uniforms.concat(J),this}uniformDeclaration(){if(this.uniforms.length===0)return"";let J=[];for(let{name:Q,type:X,length:Y}of this.uniforms)if(Y&&Y>4)X==="f16"?J.push(`@align(16) ${Q}:array<mat2x4<${X}>, ${Math.ceil(Y/8)}>`):J.push(`${Q}:array<vec4<${X}>, ${Math.ceil(Y/4)}>`);else{let H=Y==null||Y===1?X:`vec${Y}<${X}>`;J.push(`${Q}:${H}`)}return`
      struct Uniforms { ${J.join(", ")} };
      @group(0) @binding(${this.variableIndex}) var<uniform> uniforms: Uniforms;`}get additionalImplementations(){return this.uniformDeclaration()+this.variables.map((J)=>J.impl()).join(`
`)+this.internalVariables.map((J)=>J.impl()).join(`
`)}get variablesInfo(){if(this.uniforms.length===0)return;let J=(Q)=>[12,10,1,6][["u32","f16","f32","i32"].indexOf(Q)];return this.uniforms.map((Q)=>[J(Q.type),Q.length??1])}},uj=(J,Q)=>new Qq(J,Q)}),u6=J0(()=>{A0(),Z0(),J1(),C0(),Xq=(J,Q)=>{if(!J||J.length!==1)throw Error("Transpose requires 1 input.");if(Q.length!==0&&Q.length!==J[0].dims.length)throw Error(`perm size ${Q.length} does not match input rank ${J[0].dims.length}`)},jX=(J,Q)=>Q.length!==0?Q:[...Array(J).keys()].reverse(),Yq=(J,Q)=>d.sortBasedOnPerm(J,jX(J.length,Q)),Hq=(J,Q,X,Y)=>{let H=`fn perm(i: ${Y.type.indices}) -> ${X.type.indices} {
    var a: ${X.type.indices};`;for(let W=0;W<Q;++W)H+=`a[${J[W]}]=i[${W}];`;return H+="return a;}"},qq=(J,Q)=>{let X=[],Y=[];for(let H=0;H<J.length;++H)J[H]!==1&&X.push(J[H]),J[Q[H]]!==1&&Y.push(Q[H]);return{newShape:X,newPerm:Y}},Wq=(J,Q)=>{let X=0;for(let Y=0;Y<J.length;++Y)if(Q[J[Y]]!==1){if(J[Y]<X)return!1;X=J[Y]}return!0},x1=(J,Q)=>{let X=J.dataType,Y=J.dims.length,H=jX(Y,Q),W=Yq(J.dims,H),G=J.dims,j=W,N=Y<2||Wq(H,J.dims),V;if(N)return V=(R)=>{let A=a("input",X,G,4),P=M0("output",X,j,4);return`
  ${R.registerUniform("output_size","u32").declareVariables(A,P)}
  ${R.mainStart()}
    ${R.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    output[global_idx] = input[global_idx];
  }`},{name:"TransposeCopy",shaderCache:{inputDependencies:["type"]},getRunData:()=>{let R=d.size(W);return{outputs:[{dims:W,dataType:J.dataType}],dispatchGroup:{x:Math.ceil(R/64/4)},programUniforms:[{type:12,data:Math.ceil(R/4)}]}},getShaderSource:V};let{newShape:L,newPerm:B}=qq(J.dims,H),U=d.areEqual(B,[2,3,1]),E=d.areEqual(B,[3,1,2]);if(L.length===2||U||E){G=U?[L[0],L[1]*L[2]]:E?[L[0]*L[1],L[2]]:L,j=[G[1],G[0]];let R=16;return V=(A)=>{let P=a("a",X,G.length),z=M0("output",X,j.length);return`
  ${A.registerUniform("output_size","u32").declareVariables(P,z)}
  var<workgroup> tile : array<array<${z.type.value}, ${R+1}>, ${R}>;
  ${A.mainStart([R,R,1])}
    let stride = (uniforms.output_shape[1] - 1) / ${R} + 1;
    let workgroup_id_x = workgroup_index % stride;
    let workgroup_id_y = workgroup_index / stride;
    let input_col = workgroup_id_y * ${R}u + local_id.x;
    let input_row = workgroup_id_x * ${R}u + local_id.y;
    if (input_row < uniforms.a_shape[0] && input_col < uniforms.a_shape[1]) {
      tile[local_id.y][local_id.x] = ${P.getByIndices(`${P.type.indices}(input_row, input_col)`)};
    }
    workgroupBarrier();

    let output_col = workgroup_id_x * ${R}u + local_id.x;
    let output_row = workgroup_id_y * ${R}u + local_id.y;
    if (output_row < uniforms.output_shape[0] && output_col < uniforms.output_shape[1]) {
      ${z.setByIndices(`${z.type.indices}(output_row, output_col)`,"tile[local_id.x][local_id.y]")}
    }
  }`},{name:"TransposeShared",shaderCache:{inputDependencies:["type"]},getRunData:()=>{let A=d.size(W);return{outputs:[{dims:W,dataType:J.dataType}],dispatchGroup:{x:Math.ceil(j[1]/R),y:Math.ceil(j[0]/R)},programUniforms:[{type:12,data:A},...O0(G,j)]}},getShaderSource:V}}return V=(R)=>{let A=a("a",X,G.length),P=M0("output",X,j.length);return`
  ${R.registerUniform("output_size","u32").declareVariables(A,P)}

  ${Hq(H,Y,A,P)}

  ${R.mainStart()}
    ${R.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${P.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${P.setByOffset("global_idx",A.getByIndices("aIndices"))}
  }`},{name:"Transpose",shaderCache:{hint:`${Q}`,inputDependencies:["rank"]},getRunData:()=>{let R=d.size(W);return{outputs:[{dims:W,dataType:J.dataType}],dispatchGroup:{x:Math.ceil(R/64)},programUniforms:[{type:12,data:R},...O0(G,j)]}},getShaderSource:V}},oj=(J,Q)=>{Xq(J.inputs,Q.perm),J.compute(x1(J.inputs[0],Q.perm))},sj=(J)=>c0({perm:J.perm})}),FD=J0(()=>{A0(),Z0(),C0(),O3(),u6(),Gq={max:"select(bestValue, candidate, candidate > bestValue)",min:"select(bestValue, candidate, candidate < bestValue)",mean:"bestValue + candidate",sum:"bestValue + candidate",prod:"bestValue * candidate",sumSquare:"bestValue + candidate * candidate",logSumExp:"bestValue + exp(candidate)",l1:"bestValue + abs(candidate)",l2:"bestValue + candidate * candidate",logSum:"bestValue + candidate"},jq={max:"select(bestValue, candidate, candidate > bestValue)",min:"select(bestValue, candidate, candidate < bestValue)",mean:"bestValue + candidate",sum:"bestValue + candidate",prod:"bestValue * candidate",sumSquare:"bestValue + candidate",logSumExp:"bestValue + candidate",l1:"bestValue + candidate",l2:"bestValue + candidate",logSum:"bestValue + candidate"},Fq={max:"_A[offset]",min:"_A[offset]",mean:"0",sum:"0",prod:"1",sumSquare:"0",logSumExp:"0",l1:"0",l2:"0",logSum:"0"},Nq={max:"bestValue",min:"bestValue",sum:"bestValue",prod:"bestValue",sumSquare:"bestValue",logSumExp:"log(bestValue)",l1:"bestValue",l2:"sqrt(bestValue)",logSum:"log(bestValue)"},Vq=(J,Q)=>{let X=[];for(let Y=Q-J;Y<Q;++Y)X.push(Y);return X},Kq=(J,Q)=>{let X=[],Y=J.length;for(let W=0;W<Y;W++)Q.indexOf(W)===-1&&X.push(J[W]);let H=Q.map((W)=>J[W]);return[X,H]},Mq=(J,Q)=>{let X=J.length+Q.length,Y=[],H=0;for(let W=0;W<X;W++)Q.indexOf(W)===-1?Y.push(J[H++]):Y.push(1);return Y},Bq=(J,Q)=>{for(let X=0;X<J.length;++X)if(J[J.length-X-1]!==Q-1-X)return!1;return!0},Lq=(J,Q)=>{let X=[];if(!Bq(J,Q)){for(let Y=0;Y<Q;++Y)J.indexOf(Y)===-1&&X.push(Y);J.forEach((Y)=>X.push(Y))}return X},Uq=(J,Q,X,Y,H,W,G)=>{let j=X[0].dims,N=d.size(W),V=d.size(G),L=a("_A",X[0].dataType,j),B=M0("output",H,W),U=64;N===1&&(U=256);let E=`
          var<workgroup> aBestValues : array<f32, ${U}>;
       `,R=(A)=>`
        ${A.registerUniform("reduceSize","u32").declareVariables(L,B)}
        ${E}
        fn DIV_CEIL(a : u32, b : u32) -> u32 {
          return ((a - 1u) / b + 1u);
         }
         ${A.mainStart(U)}

          let outputIndex = global_idx / ${U};
          let offset = outputIndex * uniforms.reduceSize;

          var bestValue = f32(${Fq[Y]});
          let Length = uniforms.reduceSize;
          for (var k = local_idx; k < Length; k = k + ${U}) {
           let candidate = f32(${L.getByOffset("offset + k")});
           bestValue = ${Gq[Y]};
          }
          aBestValues[local_idx] = bestValue;
          workgroupBarrier();

         var reduceSize = min(Length, ${U}u);
         for (var currentSize = reduceSize / 2u; reduceSize > 1u;
             currentSize = reduceSize / 2u) {
           let interval = DIV_CEIL(reduceSize, 2u);
           if (local_idx < currentSize) {
            let candidate = aBestValues[local_idx + interval];
            bestValue = ${jq[Y]};
            aBestValues[local_idx] = bestValue;
           }
           reduceSize = interval;
           workgroupBarrier();
         }

         if (local_idx == 0u) {
          ${B.setByOffset("outputIndex",`${Y==="mean"?`${B.type.storage}(bestValue / f32(uniforms.reduceSize))`:`${B.type.storage}(${Nq[Y]})`}`)};
         }
        }`;return{name:J,shaderCache:{hint:`${Q};${U}`,inputDependencies:["type"]},getShaderSource:R,getRunData:()=>({outputs:[{dims:W,dataType:H}],dispatchGroup:{x:N},programUniforms:[{type:12,data:V}]})}},t1=(J,Q,X,Y)=>{let H=J.inputs.length===1?X:uX(J.inputs,X),W=H.axes;W.length===0&&!H.noopWithEmptyAxes&&(W=J.inputs[0].dims.map((E,R)=>R));let G=d.normalizeAxes(W,J.inputs[0].dims.length),j=G,N=J.inputs[0],V=Lq(j,J.inputs[0].dims.length);V.length>0&&(N=J.compute(x1(J.inputs[0],V),{inputs:[0],outputs:[-1]})[0],j=Vq(j.length,N.dims.length));let[L,B]=Kq(N.dims,j),U=L;H.keepDims&&(U=Mq(L,G)),J.compute(Uq(Q,H.cacheKey,[N],Y,J.inputs[0].dataType,U,B),{inputs:[N]})},aj=(J,Q)=>{t1(J,"ReduceMeanShared",Q,"mean")},ij=(J,Q)=>{t1(J,"ReduceL1Shared",Q,"l1")},nj=(J,Q)=>{t1(J,"ReduceL2Shared",Q,"l2")},rj=(J,Q)=>{t1(J,"ReduceLogSumExpShared",Q,"logSumExp")},tj=(J,Q)=>{t1(J,"ReduceMaxShared",Q,"max")},ej=(J,Q)=>{t1(J,"ReduceMinShared",Q,"min")},JF=(J,Q)=>{t1(J,"ReduceProdShared",Q,"prod")},QF=(J,Q)=>{t1(J,"ReduceSumShared",Q,"sum")},XF=(J,Q)=>{t1(J,"ReduceSumSquareShared",Q,"sumSquare")},YF=(J,Q)=>{t1(J,"ReduceLogSumShared",Q,"logSum")}}),O3=J0(()=>{A0(),Z0(),J1(),C0(),FD(),e1=(J)=>{if(!J||J.length===0||J.length>2)throw Error("Reduce op requires 1 or 2 inputs.");if(J.length===2&&J[1].dims.length!==1)throw Error("Invalid axes input dims.")},Oq=(J)=>["","",`var value = ${J.getByIndices("input_indices")};`,""],m5=(J,Q,X,Y,H,W,G=!1,j=!1)=>{let N=[],V=X[0].dims,L=V.length,B=d.normalizeAxes(H,L),U=!j&&B.length===0;V.forEach((A,P)=>{U||B.indexOf(P)>=0?G&&N.push(1):N.push(A)});let E=N.length,R=d.size(N);return{name:J,shaderCache:Q,getShaderSource:(A)=>{let P=[],z=a("_A",X[0].dataType,L),D=M0("output",W,E),S=Y(z,D,B),w=S[2];for(let k=0,I=0;k<L;k++)U||B.indexOf(k)>=0?(G&&I++,w=`for(var j${k}: u32 = 0; j${k} < ${V[k]}; j${k}++) {
                  ${S[2].includes("last_index")?`let last_index = j${k};`:""}
                  ${z.indicesSet("input_indices",k,`j${k}`)}
                  ${w}
                }`):(P.push(`${z.indicesSet("input_indices",k,D.indicesGet("output_indices",I))};`),I++);return`

        ${A.registerUniform("output_size","u32").declareVariables(z,D)}

        ${A.mainStart()}
          ${A.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          var input_indices: ${z.type.indices};
          let output_indices = ${D.offsetToIndices("global_idx")};

          ${P.join(`
`)}
          ${S[0]}       // init ops for reduce max/min
          ${S[1]}
          ${w}
          ${S[3]}
          ${S.length===4?D.setByOffset("global_idx","value"):S.slice(4).join(`
`)}
        }`},getRunData:()=>({outputs:[{dims:N,dataType:W}],dispatchGroup:{x:Math.ceil(R/64)},programUniforms:[{type:12,data:R},...O0(V,N)]})}},uX=(J,Q)=>{let X=[];return J[1].dims[0]>0&&J[1].getBigInt64Array().forEach((Y)=>X.push(Number(Y))),c0({axes:X,keepDims:Q.keepDims,noopWithEmptyAxes:Q.noopWithEmptyAxes})},J6=(J,Q,X,Y)=>{let H=J.inputs,W=H.length===1?X:uX(H,X);J.compute(m5(Q,{hint:W.cacheKey,inputDependencies:["rank"]},[H[0]],W.noopWithEmptyAxes&&W.axes.length===0?Oq:Y,W.axes,H[0].dataType,W.keepDims,W.noopWithEmptyAxes),{inputs:[0]})},Rq=(J,Q)=>{e1(J.inputs),J6(J,"ReduceLogSum",Q,(X,Y)=>[`var value = ${Y.type.storage}(0);`,"",`value += ${X.getByIndices("input_indices")};`,"value = log(value);"])},Eq=(J,Q)=>{e1(J.inputs),J6(J,"ReduceL1",Q,(X,Y)=>[`var value = ${Y.type.storage}(0);`,"",`value += abs(${X.getByIndices("input_indices")});`,""])},Dq=(J,Q)=>{e1(J.inputs),J6(J,"ReduceL2",Q,(X,Y)=>[`var t = ${Y.type.value}(0); var value = ${Y.type.value}(0);`,"",`t = ${X.getByIndices("input_indices")}; value += (t * t);`,"value = sqrt(value);"])},Aq=(J,Q)=>{e1(J.inputs),J6(J,"ReduceLogSumExp",Q,(X,Y)=>[`var value = ${Y.type.storage}(0);`,"",`value += exp(${X.getByIndices("input_indices")});`,"value = log(value);"])},zq=(J,Q)=>{e1(J.inputs),J6(J,"ReduceMax",Q,(X,Y,H)=>{let W=[];for(let G=0;G<X.rank;G++)(H.indexOf(G)>=0||H.length===0)&&W.push(X.indicesSet("input_indices",G,0));return[`${W.join(`
`)}`,`var value = ${X.getByIndices("input_indices")};`,`value = max(value, ${X.getByIndices("input_indices")});`,""]})},$q=(J,Q)=>{e1(J.inputs),J6(J,"ReduceMean",Q,(X,Y,H)=>{let W=1;for(let G=0;G<X.rank;G++)(H.indexOf(G)>=0||H.length===0)&&(W*=J.inputs[0].dims[G]);return["var sum = f32(0);","",`sum += f32(${X.getByIndices("input_indices")});`,`let value = ${Y.type.value}(sum / ${W});`]})},Pq=(J,Q)=>{e1(J.inputs),J6(J,"ReduceMin",Q,(X,Y,H)=>{let W=[];for(let G=0;G<X.rank;G++)(H.indexOf(G)>=0||H.length===0)&&W.push(`input_indices[${G}] = 0;`);return[`${W.join(`
`)}`,`var value = ${X.getByIndices("input_indices")};`,`value = min(value, ${X.getByIndices("input_indices")});`,""]})},Sq=(J,Q)=>{e1(J.inputs),J6(J,"ReduceProd",Q,(X,Y)=>[`var value = ${Y.type.storage}(1);`,"",`value *= ${X.getByIndices("input_indices")};`,""])},Zq=(J,Q)=>{e1(J.inputs),J6(J,"ReduceSum",Q,(X,Y)=>[`var value = ${Y.type.storage}(0);`,"",`value += ${X.getByIndices("input_indices")};`,""])},wq=(J,Q)=>{e1(J.inputs),J6(J,"ReduceSumSquare",Q,(X,Y)=>[`var t = ${Y.type.value}(0); var value = ${Y.type.value}(0);`,"",`t = ${X.getByIndices("input_indices")}; value += t * t;`,""])},Q6=(J,Q,X)=>{if(Q.length===0)return X;let Y=1,H=1;for(let W=0;W<Q.length;W++)Q.indexOf(W)===-1?Y*=J[W]:H*=J[W];return H<32&&Y>1024},HF=(J,Q)=>{Q6(J.inputs[0].dims,Q.axes,Q.noopWithEmptyAxes)?$q(J,Q):aj(J,Q)},qF=(J,Q)=>{Q6(J.inputs[0].dims,Q.axes,Q.noopWithEmptyAxes)?Eq(J,Q):ij(J,Q)},WF=(J,Q)=>{Q6(J.inputs[0].dims,Q.axes,Q.noopWithEmptyAxes)?Dq(J,Q):nj(J,Q)},GF=(J,Q)=>{Q6(J.inputs[0].dims,Q.axes,Q.noopWithEmptyAxes)?Aq(J,Q):rj(J,Q)},jF=(J,Q)=>{Q6(J.inputs[0].dims,Q.axes,Q.noopWithEmptyAxes)?zq(J,Q):tj(J,Q)},FF=(J,Q)=>{Q6(J.inputs[0].dims,Q.axes,Q.noopWithEmptyAxes)?Pq(J,Q):ej(J,Q)},NF=(J,Q)=>{Q6(J.inputs[0].dims,Q.axes,Q.noopWithEmptyAxes)?Sq(J,Q):JF(J,Q)},VF=(J,Q)=>{Q6(J.inputs[0].dims,Q.axes,Q.noopWithEmptyAxes)?Zq(J,Q):QF(J,Q)},KF=(J,Q)=>{Q6(J.inputs[0].dims,Q.axes,Q.noopWithEmptyAxes)?wq(J,Q):XF(J,Q)},MF=(J,Q)=>{Q6(J.inputs[0].dims,Q.axes,Q.noopWithEmptyAxes)?Rq(J,Q):YF(J,Q)}}),ND=J0(()=>{A0(),J1(),O3(),FX=(J)=>{if(!J||J.length===0||J.length>2)throw Error("ArgMinMaxOp op requires 1 or 2 inputs.");if(J[0].dataType!==1)throw Error("Invalid input type.")},BF=(J,Q)=>{FX(J.inputs);let X=(Y,H,W)=>{let G=[];for(let j=0;j<Y.rank;j++)(W.indexOf(j)>=0||W.length===0)&&G.push(`input_indices[${j}] = 0;`);return[`${G.join(`
`)}`,`var value = ${Y.getByIndices("input_indices")};
var best_index : i32 = 0;`,`if (${Y.getByIndices("input_indices")} ${Q.selectLastIndex>0?"<=":"<"} value) {
         value = ${Y.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`,"",H.setByOffset("global_idx","best_index")]};J.compute(m5("ArgMin",{hint:Q.cacheKey,inputDependencies:["rank"]},[J.inputs[0]],X,[Q.axis],7,Q.keepDims),{inputs:[0]})},LF=(J,Q)=>{FX(J.inputs);let X=(Y,H,W)=>{let G=[];for(let j=0;j<Y.rank;j++)(W.indexOf(j)>=0||W.length===0)&&G.push(`input_indices[${j}] = 0;`);return[`${G.join(`
`)}`,`var value = ${Y.getByIndices("input_indices")};
var best_index : i32 = 0;`,`if (${Y.getByIndices("input_indices")} ${Q.selectLastIndex>0?">=":">"} value) {
         value = ${Y.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`,"",H.setByOffset("global_idx","best_index")]};J.compute(m5("argMax",{hint:Q.cacheKey,inputDependencies:["rank"]},[J.inputs[0]],X,[Q.axis],7,Q.keepDims),{inputs:[0]})},oX=(J)=>c0(J)}),R3=J0(()=>{A0(),Z0(),L3(),C0(),kq=(J,Q)=>{let X=J[0],Y=J[1],H=J[2],W=J[3],G=J[4],j=J[5];if(G&&j)throw Error("Attention cannot have both past and attention_bias");if(X.dims.length!==3)throw Error('Input "input" must have 3 dimensions');let N=X.dims[0],V=X.dims[1],L=X.dims[2];if(H.dims.length!==1)throw Error('Input "bias" is expected to have 1 dimensions');if(Y.dims.length!==2)throw Error('Input "weights" is expected to have 2 dimensions');if(Y.dims[0]!==L)throw Error("Input 1 dimension 0 should have same length as dimension 2 of input 0");if(H.dims[0]!==Y.dims[1])throw Error('Input "bias" dimension 0 should have same length as dimension 1 of input "weights"');let B=H.dims[0]/3,U=B,E=U;if(Q.qkvHiddenSizes.length>0){if(Q.qkvHiddenSizes.length!==3)throw Error("qkv_hidden_sizes attribute should have 3 elements");for(let S of Q.qkvHiddenSizes)if(S%Q.numHeads!==0)throw Error("qkv_hidden_sizes should be divisible by num_heads");B=Q.qkvHiddenSizes[0],U=Q.qkvHiddenSizes[1],E=Q.qkvHiddenSizes[2]}let R=V;if(B!==U)throw Error("qkv_hidden_sizes first element should be same as the second");if(H.dims[0]!==B+U+E)throw Error('Input "bias" dimension 0 should have same length as sum of Q/K/V hidden sizes');let A=0;if(G){if(U!==E)throw Error('Input "past" expect k_hidden_size == v_hidden_size');if(G.dims.length!==5)throw Error('Input "past" must have 5 dimensions');if(G.dims[0]!==2)throw Error('Input "past" first dimension must be 2');if(G.dims[1]!==N)throw Error('Input "past" second dimension must be batch_size');if(G.dims[2]!==Q.numHeads)throw Error('Input "past" third dimension must be num_heads');if(G.dims[4]!==U/Q.numHeads)throw Error('Input "past" fifth dimension must be k_hidden_size / num_heads');Q.pastPresentShareBuffer||(A=G.dims[3])}let P=R+A,z=-1,D=0;if(W)throw Error("Mask not supported");if(G)throw Error("past is not supported");if(j){if(j.dims.length!==4)throw Error('Input "attention_bias" must have 4 dimensions');if(j.dims[0]!==N||j.dims[1]!==Q.numHeads||j.dims[2]!==V||j.dims[3]!==P)throw Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)')}return{batchSize:N,sequenceLength:V,pastSequenceLength:A,kvSequenceLength:R,totalSequenceLength:P,maxSequenceLength:z,inputHiddenSize:L,hiddenSize:B,vHiddenSize:E,headSize:Math.floor(B/Q.numHeads),vHeadSize:Math.floor(E/Q.numHeads),numHeads:Q.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:Q.maskFilterValue,maskType:D,scale:Q.scale,broadcastResPosBias:!1,passPastInKv:!1,qkvFormat:1}},k5=(J,Q,X)=>Q&&J?`
      let total_sequence_length_input = u32(${Q.getByOffset("0")});
      let present_sequence_length = max(total_sequence_length_input, uniforms.past_sequence_length);
      let is_subsequent_prompt: bool = sequence_length > 1 && sequence_length != total_sequence_length_input;
      let is_first_prompt: bool = is_subsequent_prompt == false && sequence_length == total_sequence_length_input;
      total_sequence_length = u32(${J?.getByOffset("batchIdx")}) + 1;
      var past_sequence_length: u32 = 0;
      if (is_first_prompt == false) {
        past_sequence_length = total_sequence_length - sequence_length;
      }
       `:`
    ${X?"let past_sequence_length = uniforms.past_sequence_length":""};
    let present_sequence_length = total_sequence_length;
    `,Cq=(J,Q,X,Y,H,W,G,j)=>{let N=t0(G?1:W),V=64,L=W/N;L<V&&(V=32);let B=Math.ceil(W/N/V),U=[{type:12,data:Q},{type:12,data:X},{type:12,data:Y},{type:12,data:H},{type:12,data:L},{type:12,data:B}],E=N1(J.dataType,N),R=$1(1,N),A=["type"];G&&A.push("type"),j&&A.push("type");let P=(z)=>{let D=M0("x",J.dataType,J.dims,N),S=[D],w=G?a("seq_lens",G.dataType,G.dims):void 0;w&&S.push(w);let k=j?a("total_sequence_length_input",j.dataType,j.dims):void 0;k&&S.push(k);let I=$1(J.dataType),C=[{name:"batch_size",type:"u32"},{name:"num_heads",type:"u32"},{name:"past_sequence_length",type:"u32"},{name:"sequence_length",type:"u32"},{name:"total_sequence_length",type:"u32"},{name:"elements_per_thread",type:"u32"}];return`
  var<workgroup> thread_max: array<f32, ${V}>;
  var<workgroup> thread_sum: array<f32, ${V}>;
  ${z.registerUniforms(C).declareVariables(...S)}
  ${z.mainStart([V,1,1])}
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let sequence_length = uniforms.sequence_length;
    var total_sequence_length = uniforms.total_sequence_length;
    ${k5(w,k,!1)}
    let local_offset = local_idx * uniforms.elements_per_thread;
    let offset = (global_idx / ${V}) * uniforms.total_sequence_length + local_offset;
    let seq_causal_length = ${G?"u32(past_sequence_length + workgroup_id.y + 1)":"total_sequence_length"};
    var thread_max_vector = ${R}(-3.402823e+38f);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      thread_max_vector = max(${R}(x[offset + i]), thread_max_vector);
    }
    thread_max[local_idx] = ${(()=>{switch(N){case 1:return"thread_max_vector";case 2:return"max(thread_max_vector.x, thread_max_vector.y)";case 4:return"max(max(thread_max_vector.x, thread_max_vector.y), max(thread_max_vector.z, thread_max_vector.w))";default:throw Error(`Unsupported components: ${N}`)}})()};
    workgroupBarrier();

    var max_value =  f32(-3.402823e+38f);
    for (var i = 0u; i < ${V}; i++) {
      max_value = max(thread_max[i], max_value);
    }

    var sum_vector = ${R}(0);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      sum_vector += exp(${R}(x[offset + i]) - max_value);
    }
    thread_sum[local_idx] = ${(()=>{switch(N){case 1:return"sum_vector";case 2:return"sum_vector.x + sum_vector.y";case 4:return"sum_vector.x + sum_vector.y + sum_vector.z + sum_vector.w";default:throw Error(`Unsupported components: ${N}`)}})()};
    workgroupBarrier();

    var sum: f32 = 0;
    for (var i = 0u; i < ${V}; i++) {
      sum += thread_sum[i];
    }

    if (sum == 0) {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        x[offset + i] = ${D.type.value}(${I}(1.0) / ${I}(seq_causal_length));
      }
    } else {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        var f32input = ${R}(x[offset + i]);
        x[offset + i] = ${D.type.value}(exp(f32input - max_value) / sum);
      }
    }
      ${G?`
        for (var total_seq_id: u32 = seq_causal_length; total_seq_id + local_offset < uniforms.total_sequence_length; total_seq_id++) {
          x[offset + total_seq_id] = ${D.type.value}(${I}(0));
        }`:""};
  }`};return{name:"AttentionProbsSoftmax",shaderCache:{hint:`${V};${E};${N}`,inputDependencies:A},getShaderSource:P,getRunData:()=>({outputs:[],dispatchGroup:{x:Math.ceil(W/V),y:H,z:Q*X},programUniforms:U})}},Iq=(J,Q,X,Y,H,W,G,j,N)=>{let V=G+W.kvSequenceLength,L=[W.batchSize,W.numHeads,W.sequenceLength,V],B=J>1&&Y,U=W.kvNumHeads?W.kvNumHeads:W.numHeads,E=B?[W.batchSize,U,V,W.headSize]:void 0,R=W.nReps?W.nReps:1,A=W.scale===0?1/Math.sqrt(W.headSize):W.scale,P=t0(W.headSize),z=W.headSize/P,D=12,S={x:Math.ceil(V/D),y:Math.ceil(W.sequenceLength/D),z:W.batchSize*W.numHeads},w=[{type:12,data:W.sequenceLength},{type:12,data:z},{type:12,data:V},{type:12,data:W.numHeads},{type:12,data:W.headSize},{type:1,data:A},{type:12,data:G},{type:12,data:W.kvSequenceLength},{type:12,data:R}],k=B&&Y&&d.size(Y.dims)>0,I=["type","type"];k&&I.push("type"),H&&I.push("type"),j&&I.push("type"),N&&I.push("type");let C=[{dims:L,dataType:Q.dataType,gpuDataType:0}];B&&C.push({dims:E,dataType:Q.dataType,gpuDataType:0});let T=(g)=>{let m=a("q",Q.dataType,Q.dims,P),l=a("key",X.dataType,X.dims,P),t=[m,l];if(k){let s=a("past_key",Y.dataType,Y.dims,P);t.push(s)}H&&t.push(a("attention_bias",H.dataType,H.dims));let h=j?a("seq_lens",j.dataType,j.dims):void 0;h&&t.push(h);let W0=N?a("total_sequence_length_input",N.dataType,N.dims):void 0;W0&&t.push(W0);let j0=M0("output",Q.dataType,L),o=[j0];B&&o.push(M0("present_key",Q.dataType,E,P));let G0=$1(1,P),F0=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"alpha",type:"f32"},{name:"past_sequence_length",type:"u32"},{name:"kv_sequence_length",type:"u32"},{name:"n_reps",type:"u32"}];return`
  const TILE_SIZE = ${D}u;

  var<workgroup> tileQ: array<${m.type.storage}, ${D*D}>;
  var<workgroup> tileK: array<${m.type.storage}, ${D*D}>;
  ${g.registerUniforms(F0).declareVariables(...t,...o)}
  ${g.mainStart([D,D,1])}
    // x holds the N and y holds the M
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let kvHeadIdx = ${R===1?"headIdx":"headIdx / uniforms.n_reps"};
    let kv_num_heads = ${R===1?"uniforms.num_heads":"uniforms.num_heads / uniforms.n_reps"};
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let m = workgroup_id.y * TILE_SIZE;
    let n = workgroup_id.x * TILE_SIZE;
    let sequence_length = uniforms.M;
    var total_sequence_length = uniforms.N;
    ${k5(h,W0,!0)}
    let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx;
    let qOffset = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
    ${k&&B?"let pastKeyOffset = absKvHeadIdx * uniforms.past_sequence_length * uniforms.K;":""};
    let kOffset = absKvHeadIdx * uniforms.kv_sequence_length * uniforms.K;
    ${B?"let presentKeyOffset = absKvHeadIdx * uniforms.N * uniforms.K;":""}
    var value = ${G0}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (global_id.y < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = q[qOffset + local_id.y * uniforms.K + w + local_id.x];
      }
      if (n + local_id.y < uniforms.N && w + local_id.x < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
      ${k&&B?`
              if (n + local_id.y < past_sequence_length) {
                tileK[idx] = past_key[pastKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
              } else if (n + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
                tileK[idx] = key[kOffset + (n + local_id.y - past_sequence_length) * uniforms.K + w + local_id.x];
              }`:`
          if (n + local_id.y < uniforms.kv_sequence_length) {
            tileK[idx] = key[kOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
          }`}
      ${B?`if (n + local_id.y < present_sequence_length) {
        present_key[presentKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x] = tileK[idx];
      }`:""}
      }
      workgroupBarrier();

      for (var k: u32 = 0u; k < TILE_SIZE && w+k < uniforms.K; k++) {
          value += ${G0}(tileQ[TILE_SIZE * local_id.y + k] * tileK[TILE_SIZE * local_id.x + k]);
      }

      workgroupBarrier();
    }

    if (global_id.y < uniforms.M && global_id.x < total_sequence_length) {
      let headOffset = workgroup_id.z * uniforms.M * uniforms.N;
      let outputIdx = headOffset + global_id.y * uniforms.N + global_id.x;
      var sum: f32 = ${(()=>{switch(P){case 1:return"value";case 2:return"value.x + value.y";case 4:return"value.x + value.y + value.z + value.w";default:throw Error(`Unsupported components: ${P}`)}})()};
        output[outputIdx] = ${j0.type.value} (sum * uniforms.alpha) + ${H?"attention_bias[outputIdx]":"0.0"};
    }
  }`};return{name:"AttentionProbs",shaderCache:{hint:`${P};${H!==void 0};${Y!==void 0};${J}`,inputDependencies:I},getRunData:()=>({outputs:C,dispatchGroup:S,programUniforms:w}),getShaderSource:T}},_q=(J,Q,X,Y,H,W,G=void 0,j=void 0)=>{let N=W+H.kvSequenceLength,V=H.nReps?H.nReps:1,L=H.vHiddenSize*V,B=J>1&&Y,U=H.kvNumHeads?H.kvNumHeads:H.numHeads,E=B?[H.batchSize,U,N,H.headSize]:void 0,R=[H.batchSize,H.sequenceLength,L],A=12,P={x:Math.ceil(H.vHeadSize/A),y:Math.ceil(H.sequenceLength/A),z:H.batchSize*H.numHeads},z=[{type:12,data:H.sequenceLength},{type:12,data:N},{type:12,data:H.vHeadSize},{type:12,data:H.numHeads},{type:12,data:H.headSize},{type:12,data:L},{type:12,data:W},{type:12,data:H.kvSequenceLength},{type:12,data:V}],D=B&&Y&&d.size(Y.dims)>0,S=["type","type"];D&&S.push("type"),G&&S.push("type"),j&&S.push("type");let w=[{dims:R,dataType:Q.dataType,gpuDataType:0}];B&&w.push({dims:E,dataType:Q.dataType,gpuDataType:0});let k=(I)=>{let C=a("probs",Q.dataType,Q.dims),T=a("v",X.dataType,X.dims),g=[C,T];D&&g.push(a("past_value",Y.dataType,Y.dims));let m=G?a("seq_lens",G.dataType,G.dims):void 0;G&&g.push(m);let l=j?a("total_sequence_length_input",j.dataType,j.dims):void 0;j&&g.push(l);let t=[M0("output",Q.dataType,R)];B&&t.push(M0("present_value",Q.dataType,E));let h=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"v_hidden_size",type:"u32"},{name:"past_sequence_length",type:"u32"},{name:"kv_sequence_length",type:"u32"},{name:"n_reps",type:"u32"}];return`
  const TILE_SIZE = ${A}u;
  var<workgroup> tileQ: array<${C.type.value}, ${A*A}>;
  var<workgroup> tileV: array<${C.type.value}, ${A*A}>;
  ${I.registerUniforms(h).declareVariables(...g,...t)}
  ${I.mainStart([A,A,1])}
   let headIdx = workgroup_id.z % uniforms.num_heads;
   let batchIdx = workgroup_id.z / uniforms.num_heads;
   let kvHeadIdx = ${V===1?"headIdx":"headIdx / uniforms.n_reps"};
   let kv_num_heads = ${V===1?"uniforms.num_heads":"uniforms.num_heads / uniforms.n_reps"};
   let m = global_id.y;
   let n = global_id.x;
   let sequence_length = uniforms.M;
   var total_sequence_length = uniforms.K;
   ${k5(m,l,!0)}
   let offsetA = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
   let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx; // kvHeadIdx is relative to the batch
   ${D&&B?"let pastValueOffset = absKvHeadIdx * uniforms.N * uniforms.past_sequence_length + n;":""};
   let vOffset = absKvHeadIdx * uniforms.N * uniforms.kv_sequence_length + n;
   ${B?"let presentValueOffset = absKvHeadIdx * uniforms.N * uniforms.K + n;":""}
   var value = ${C.type.storage}(0);
   for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = probs[offsetA + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
        ${D&&B?`
        if (w + local_id.y < past_sequence_length) {
          tileV[idx] = past_value[pastValueOffset + (w + local_id.y) * uniforms.N];
        } else if (w + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
          tileV[idx] = v[vOffset + (w + local_id.y - past_sequence_length) * uniforms.N];
        }
      `:`
            if (w + local_id.y < uniforms.kv_sequence_length) {
              tileV[idx] = v[vOffset + (w + local_id.y) * uniforms.N];
            }`}
        ${B?`
            if (w + local_id.y < present_sequence_length) {
          present_value[presentValueOffset + (w + local_id.y) * uniforms.N] = tileV[idx];
        }`:""}
      }
     workgroupBarrier();
     for (var k: u32 = 0u; k < TILE_SIZE && w+k < total_sequence_length; k++) {
       value += tileQ[TILE_SIZE * local_id.y + k] * tileV[TILE_SIZE * k + local_id.x];
     }
     workgroupBarrier();
   }

   // we need to transpose output from BNSH_v to BSND_v
   if (m < uniforms.M && n < uniforms.N) {
     let outputIdx = batchIdx * uniforms.M * uniforms.v_hidden_size + m * uniforms.v_hidden_size
       + headIdx * uniforms.N + n;
     output[outputIdx] = value;
   }
  }`};return{name:"AttentionScore",shaderCache:{hint:`${Y!==void 0};${J}`,inputDependencies:S},getRunData:()=>({outputs:w,dispatchGroup:P,programUniforms:z}),getShaderSource:k}},f2=(J,Q,X,Y,H,W,G,j,N,V,L=void 0,B=void 0)=>{let U=Math.min(J.outputCount,1+(G?1:0)+(j?1:0)),E=U>1?V.pastSequenceLength:0,R=E+V.kvSequenceLength,A=N&&d.size(N.dims)>0?N:void 0,P=[Q,X];U>1&&G&&d.size(G.dims)>0&&P.push(G),A&&P.push(A),L&&P.push(L),B&&P.push(B);let z=J.compute(Iq(U,Q,X,G,A,V,E,L,B),{inputs:P,outputs:U>1?[-1,1]:[-1]})[0];J.compute(Cq(z,V.batchSize,V.numHeads,E,V.sequenceLength,R,L,B),{inputs:L&&B?[z,L,B]:[z],outputs:[]});let D=[z,Y];U>1&&j&&d.size(j.dims)>0&&D.push(j),L&&D.push(L),B&&D.push(B),J.compute(_q(U,z,Y,j,V,E,L,B),{inputs:D,outputs:U>1?[0,2]:[0]})},bq=(J,Q)=>{let X=[Q.batchSize,Q.numHeads,Q.sequenceLength,Q.headSize],Y=Q.sequenceLength,H=Q.inputHiddenSize,W=Q.headSize,G=12,j={x:Math.ceil(Q.headSize/G),y:Math.ceil(Q.sequenceLength/G),z:Q.batchSize*Q.numHeads},N=[J.inputs[0],J.inputs[1],J.inputs[2]],V=[{type:12,data:Y},{type:12,data:H},{type:12,data:W},{type:12,data:Q.numHeads},{type:12,data:Q.headSize},{type:12,data:Q.hiddenSize},{type:12,data:Q.hiddenSize+Q.hiddenSize+Q.vHiddenSize}],L=(B)=>{let U=M0("output_q",N[0].dataType,X),E=M0("output_k",N[0].dataType,X),R=M0("output_v",N[0].dataType,X),A=a("input",N[0].dataType,N[0].dims),P=a("weight",N[1].dataType,N[1].dims),z=a("bias",N[2].dataType,N[2].dims),D=A.type.storage,S=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"hidden_size",type:"u32"},{name:"ldb",type:"u32"}];return`
  const TILE_SIZE = ${G}u;
  var<workgroup> tileInput: array<${D}, ${G*G}>;
  var<workgroup> tileWeightQ: array<${D}, ${G*G}>;
  var<workgroup> tileWeightK: array<${D}, ${G*G}>;
  var<workgroup> tileWeightV: array<${D}, ${G*G}>;
  ${B.registerUniforms(S).declareVariables(A,P,z,U,E,R)}
  ${B.mainStart([G,G,1])}
    let batchIndex = workgroup_id.z / uniforms.num_heads;
    let headNumber = workgroup_id.z % uniforms.num_heads;
    let m = global_id.y;
    let n = global_id.x;

    let inputOffset = batchIndex * (uniforms.M * uniforms.K) + m * uniforms.K;
    let biasOffsetQ = headNumber * uniforms.head_size;
    let biasOffsetK = uniforms.hidden_size + biasOffsetQ;
    let biasOffsetV = uniforms.hidden_size + biasOffsetK;

    var valueQ = ${D}(0);
    var valueK = ${D}(0);
    var valueV = ${D}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileInput[TILE_SIZE * local_id.y + local_id.x] = input[inputOffset + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        let offset = n + (w + local_id.y) * uniforms.ldb;
        tileWeightQ[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetQ + offset];
        tileWeightK[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetK + offset];
        tileWeightV[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetV + offset];
      }
      workgroupBarrier();
      for (var k: u32 = 0u; k<TILE_SIZE && w+k < uniforms.K; k++) {
        let inputTileOffset = TILE_SIZE * local_id.y + k;
        let weightTileOffset = TILE_SIZE * k + local_id.x;
        valueQ += tileInput[inputTileOffset] * tileWeightQ[weightTileOffset];
        valueK += tileInput[inputTileOffset] * tileWeightK[weightTileOffset];
        valueV += tileInput[inputTileOffset] * tileWeightV[weightTileOffset];
      }

      workgroupBarrier();
    }

    let headOffset = (m * uniforms.N + n) % uniforms.head_size;
    valueQ += bias[headOffset + biasOffsetQ];
    valueK += bias[headOffset + biasOffsetK];
    valueV += bias[headOffset + biasOffsetV];

    let offset = workgroup_id.z * uniforms.M * uniforms.N;
    if (m < uniforms.M && n < uniforms.N) {
      let outputIdx = offset + m * uniforms.N + n;
      output_q[outputIdx] = valueQ;
      output_k[outputIdx] = valueK;
      output_v[outputIdx] = valueV;
    }
  }`};return J.compute({name:"AttentionPrepare",shaderCache:{inputDependencies:["type","type","type"]},getRunData:()=>({outputs:[{dims:X,dataType:J.inputs[0].dataType,gpuDataType:0},{dims:X,dataType:J.inputs[0].dataType,gpuDataType:0},{dims:X,dataType:J.inputs[0].dataType,gpuDataType:0}],dispatchGroup:j,programUniforms:V}),getShaderSource:L},{inputs:N,outputs:[-1,-1,-1]})},UF=(J,Q)=>{let X=kq(J.inputs,Q),[Y,H,W]=bq(J,X);return f2(J,Y,H,W,J.inputs[4],void 0,void 0,void 0,J.inputs[5],X)}}),VD=J0(()=>{q6(),A0(),Z0(),J1(),C0(),vq=(J,Q)=>{if(!J||J.length!==5)throw Error("BatchNormalization requires 5 inputs");let X=(Y,H,W)=>{let G=H.length;if(G!==Y.length)throw Error(`${W}: num dimensions != ${G}`);H.forEach((j,N)=>{if(j!==Y[N])throw Error(`${W}: dim[${N}] do not match`)})};if(J[0].dims.length>1){let Y=Q.format==="NHWC"?Q.spatial?J[0].dims.slice(-1):J[0].dims.slice(-1).concat(J[0].dims.slice(1,J[0].dims.length-1)):J[0].dims.slice(1,Q.spatial?2:void 0);X(J[1].dims,Y,"Invalid input scale"),X(J[2].dims,Y,"Invalid input B"),X(J[3].dims,Y,"Invalid input mean"),X(J[4].dims,Y,"Invalid input var")}else X(J[1].dims,[1],"Invalid input scale"),X(J[2].dims,[1],"Invalid input B"),X(J[3].dims,[1],"Invalid input mean"),X(J[4].dims,[1],"Invalid input var")},Tq=(J,Q)=>{let{epsilon:X,spatial:Y,format:H}=Q,W=J[0].dims,G=Y?t0(W[W.length-1]):1,j=H==="NHWC"&&W.length>1?G:1,N=d.size(W)/G,V=Y,L=V?W.length:W,B=a("x",J[0].dataType,J[0].dims,G),U=a("scale",J[1].dataType,J[1].dims,j),E=a("bias",J[2].dataType,J[2].dims,j),R=a("inputMean",J[3].dataType,J[3].dims,j),A=a("inputVar",J[4].dataType,J[4].dims,j),P=M0("y",J[0].dataType,L,G),z=()=>{let S="";if(Y)S=`let cOffset = ${W.length===1?"0u":H==="NHWC"?`outputIndices[${W.length-1}] / ${G}`:"outputIndices[1]"};`;else if(H==="NCHW")S=`
            ${P.indicesSet("outputIndices","0","0")}
            let cOffset = ${P.indicesToOffset("outputIndices")};`;else{S=`var cIndices = ${U.type.indices}(0);
                       cIndices[0] = outputIndices[${W.length-1}];`;for(let w=1;w<U.rank;w++)S+=`cIndices[${w}] = outputIndices[${w}];`;S+=`let cOffset = ${U.indicesToOffset("cIndices")};`}return S},D=(S)=>`
  const epsilon = ${X};
  ${S.registerUniform("outputSize","u32").declareVariables(B,U,E,R,A,P)}
  ${S.mainStart()}
  ${S.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
    var outputIndices = ${P.offsetToIndices(`global_idx * ${G}`)};
    ${z()}
    let scale = ${U.getByOffset("cOffset")};
    let bias = ${E.getByOffset("cOffset")};
    let inputMean = ${R.getByOffset("cOffset")};
    let inputVar = ${A.getByOffset("cOffset")};
    let x = ${B.getByOffset("global_idx")};
    let value = (x - inputMean) * inverseSqrt(inputVar + epsilon) * scale + bias;
    ${P.setByOffset("global_idx","value")}
  }`;return{name:"BatchNormalization",shaderCache:{hint:`${Q.epsilon}_${Q.format}_${Y}_${G}`,inputDependencies:V?["rank","type","type","type","type"]:void 0},getShaderSource:D,getRunData:()=>({outputs:[{dims:J[0].dims,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(N/64)},programUniforms:V?[{type:12,data:N},...O0(W)]:[{type:12,data:N}]})}},xq=(J)=>c0(J),OF=(J,Q)=>{let{inputs:X,outputCount:Y}=J,H=xq({...Q,outputCount:Y});if(a0.webgpu.validateInputContent&&vq(X,H),Q.trainingMode)throw Error("BatchNormalization trainingMode is not supported yet.");J.compute(Tq(X,H))}}),KD=J0(()=>{Z0(),C0(),fq=(J)=>{if(J[0].dims.length!==3)throw Error("input should have 3 dimensions");if(![320,640,1280].includes(J[0].dims[2]))throw Error("number of channels should be 320, 640 or 1280");if(J[1].dims.length!==1)throw Error("bias is expected to have 1 dimensions");if(J[0].dims[2]!==J[1].dims[0])throw Error("last dimension of input and bias are not the same")},hq=(J)=>{let Q=J[0].dims,X=J[0].dims[2],Y=d.size(Q)/4,H=J[0].dataType,W=a("input",H,Q,4),G=a("bias",H,[X],4),j=a("residual",H,Q,4),N=M0("output",H,Q,4);return{name:"BiasAdd",getRunData:()=>({outputs:[{dims:Q,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(Y/64)}}),getShaderSource:(V)=>`
  const channels = ${X}u / 4;
  ${V.declareVariables(W,G,j,N)}

  ${V.mainStart()}
    ${V.guardAgainstOutOfBoundsWorkgroupSizes(Y)}
    let value = ${W.getByOffset("global_idx")}
      + ${G.getByOffset("global_idx % channels")} + ${j.getByOffset("global_idx")};
    ${N.setByOffset("global_idx","value")}
  }`}},RF=(J)=>{fq(J.inputs),J.compute(hq(J.inputs))}}),E3=J0(()=>{A0(),Z0(),J1(),C0(),yq=(J,Q,X,Y,H,W,G)=>{let j=Math.ceil(Q/4),N="";typeof H=="string"?N=`${H}(a)`:N=H("a");let V=a("inputData",X,[j],4),L=M0("outputData",Y,[j],4),B=[{name:"vec_size",type:"u32"}];return G&&B.push(...G),`
      ${J.registerUniforms(B).declareVariables(V,L)}

  ${W??""}

  ${J.mainStart()}
    ${J.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}

    let a = ${V.getByOffset("global_idx")};
    ${L.setByOffset("global_idx",N)}
  }`},y0=(J,Q,X,Y,H,W=J.dataType,G,j)=>{let N=[{type:12,data:Math.ceil(d.size(J.dims)/4)}];return G&&N.push(...G),{name:Q,shaderCache:{hint:H,inputDependencies:["type"]},getShaderSource:(V)=>yq(V,d.size(J.dims),J.dataType,W,X,Y,j),getRunData:(V)=>({outputs:[{dims:J.dims,dataType:W}],dispatchGroup:{x:Math.ceil(d.size(V[0].dims)/64/4)},programUniforms:N})}},EF=(J)=>{J.compute(y0(J.inputs[0],"Abs","abs"))},DF=(J)=>{J.compute(y0(J.inputs[0],"Acos","acos"))},AF=(J)=>{J.compute(y0(J.inputs[0],"Acosh","acosh"))},zF=(J)=>{J.compute(y0(J.inputs[0],"Asin","asin"))},$F=(J)=>{J.compute(y0(J.inputs[0],"Asinh","asinh"))},PF=(J)=>{J.compute(y0(J.inputs[0],"Atan","atan"))},SF=(J)=>{J.compute(y0(J.inputs[0],"Atanh","atanh"))},ZF=(J)=>c0(J),wF=(J,Q)=>{let X;switch(Q.to){case 10:X="vec4<f16>";break;case 1:X="vec4<f32>";break;case 12:X="vec4<u32>";break;case 6:X="vec4<i32>";break;case 9:X="vec4<bool>";break;default:throw RangeError(`not supported type (specified in attribute 'to' from 'Cast' operator): ${Q.to}`)}J.compute(y0(J.inputs[0],"Cast",X,void 0,Q.cacheKey,Q.to))},gq=(J)=>{let Q,X,Y=J.length>=2&&J[1].data!==0,H=J.length>=3&&J[2].data!==0;switch(J[0].dataType){case 1:Q=Y?J[1].getFloat32Array()[0]:-340282346638528860000000000000000000000,X=H?J[2].getFloat32Array()[0]:340282346638528860000000000000000000000;break;case 10:Q=Y?J[1].getUint16Array()[0]:64511,X=H?J[2].getUint16Array()[0]:31743;break;default:throw Error("Unsupport data type")}return c0({min:Q,max:X})},kF=(J,Q)=>{let X=Q||gq(J.inputs),Y=$1(J.inputs[0].dataType);J.compute(y0(J.inputs[0],"Clip",(H)=>`clamp(${H}, vec4<${Y}>(uniforms.min), vec4<${Y}>(uniforms.max))`,void 0,X.cacheKey,void 0,[{type:J.inputs[0].dataType,data:X.min},{type:J.inputs[0].dataType,data:X.max}],[{name:"min",type:Y},{name:"max",type:Y}]),{inputs:[0]})},CF=(J)=>{J.compute(y0(J.inputs[0],"Ceil","ceil"))},IF=(J)=>{J.compute(y0(J.inputs[0],"Cos","cos"))},_F=(J)=>{J.compute(y0(J.inputs[0],"Cosh","cosh"))},b2=(J)=>c0(J),bF=(J,Q)=>{let X=$1(J.inputs[0].dataType);J.compute(y0(J.inputs[0],"Elu",(Y)=>`elu_vf32(${Y})`,`
  const elu_alpha_ = ${X}(${Q.alpha});

  fn elu_f32(a: ${X}) -> ${X} {
  return select((exp(a) - 1.0) * elu_alpha_, a, a >= 0.0);
  }

  fn elu_vf32(v: vec4<${X}>) -> vec4<${X}> {
  return vec4(elu_f32(v.x), elu_f32(v.y), elu_f32(v.z), elu_f32(v.w));
  }`,Q.cacheKey))},f5=(J="f32")=>`
const r0: ${J} = 0.3275911;
const r1: ${J} = 0.254829592;
const r2: ${J} = -0.284496736;
const r3: ${J} = 1.421413741;
const r4: ${J} = -1.453152027;
const r5: ${J} = 1.061405429;

fn erf_vf32(v: vec4<${J}>) -> vec4<${J}> {
  let absv = abs(v);
  let x = 1.0 / (1.0 + r0 * absv);
  return sign(v) * (1.0 - ((((r5 * x + r4) * x + r3) * x + r2) * x + r1) * x * exp(-absv * absv));
}`,vF=(J)=>{let Q=$1(J.inputs[0].dataType);J.compute(y0(J.inputs[0],"Erf",(X)=>`erf_vf32(${X})`,f5(Q)))},TF=(J)=>{J.compute(y0(J.inputs[0],"Exp","exp"))},xF=(J)=>{J.compute(y0(J.inputs[0],"Floor","floor"))},fF=(J)=>{let Q=$1(J.inputs[0].dataType);J.compute(y0(J.inputs[0],"Gelu",(X)=>`0.5 * ${X} * (1.0 + erf_vf32(${X} * 0.7071067811865475))`,f5(Q)))},hF=(J,Q)=>{let X=$1(J.inputs[0].dataType);J.compute(y0(J.inputs[0],"LeakyRelu",(Y)=>`select(leaky_relu_alpha_ * ${Y}, ${Y}, ${Y} >= vec4<${X}>(0.0))`,`const leaky_relu_alpha_ = ${X}(${Q.alpha});`,Q.cacheKey))},yF=(J)=>{J.compute(y0(J.inputs[0],"Not",(Q)=>`!${Q}`))},gF=(J)=>{J.compute(y0(J.inputs[0],"Neg",(Q)=>`-${Q}`))},lF=(J)=>{J.compute(y0(J.inputs[0],"Reciprocal",(Q)=>`1.0/${Q}`))},mF=(J)=>{let Q=$1(J.inputs[0].dataType);J.compute(y0(J.inputs[0],"Relu",(X)=>`select(vec4<${Q}>(0.0), ${X}, ${X} > vec4<${Q}>(0.0))`))},pF=(J)=>{J.compute(y0(J.inputs[0],"Sigmoid",(Q)=>`(1.0 / (1.0 + exp(-${Q})))`))},cF=(J)=>c0(J),dF=(J,Q)=>{let X=$1(J.inputs[0].dataType);J.compute(y0(J.inputs[0],"HardSigmoid",(Y)=>`max(vec4<${X}>(0.0), min(vec4<${X}>(1.0), ${Q.alpha} * ${Y} + vec4<${X}>(${Q.beta})))`,void 0,Q.cacheKey))},uF=(J)=>{J.compute(y0(J.inputs[0],"Sin","sin"))},oF=(J)=>{J.compute(y0(J.inputs[0],"Sinh","sinh"))},sF=(J)=>{J.compute(y0(J.inputs[0],"Sqrt","sqrt"))},aF=(J)=>{J.compute(y0(J.inputs[0],"Tan","tan"))},NX=(J)=>`sign(${J}) * (1 - exp(-2 * abs(${J}))) / (1 + exp(-2 * abs(${J})))`,iF=(J)=>{J.compute(y0(J.inputs[0],"Tanh",NX))},sX=(J="f32")=>`
const fast_gelu_a: ${J} = 0.5;
const fast_gelu_b: ${J} = 0.7978845608028654;
const fast_gelu_c: ${J} = 0.035677408136300125;

fn tanh_v(v: vec4<${J}>) -> vec4<${J}> {
  return ${NX("v")};
}
`,aX=(J)=>`(fast_gelu_a + fast_gelu_a * tanh_v(${J} * (fast_gelu_c * ${J} * ${J} + fast_gelu_b))) * ${J}`,nF=(J)=>{let Q=$1(J.inputs[0].dataType);J.compute(y0(J.inputs[0],"FastGelu",aX,sX(Q),void 0,J.inputs[0].dataType))},rF=(J,Q)=>{let X=$1(J.inputs[0].dataType);return J.compute(y0(J.inputs[0],"ThresholdedRelu",(Y)=>`select(vec4<${X}>(0.0), ${Y}, ${Y} > thresholded_relu_alpha_)`,`const thresholded_relu_alpha_ = vec4<${X}>(${Q.alpha});`,Q.cacheKey)),0},tF=(J)=>{J.compute(y0(J.inputs[0],"Log","log"))},lq=(J,Q)=>`
const alpha = vec4<${J}>(${Q});
const one = ${J}(1.0);
const zero = ${J}(0.0);

fn quick_gelu_impl(x: vec4<${J}>) -> vec4<${J}> {
  let v = x *alpha;
  var x1 : vec4<${J}>;
  for (var i = 0; i < 4; i = i + 1) {
    if (v[i] >= zero) {
      x1[i] = one / (one + exp(-v[i]));
    } else {
      x1[i] = one - one / (one + exp(v[i]));
    }
  }
  return x * x1;
}
`,mq=(J)=>`quick_gelu_impl(${J})`,eF=(J,Q)=>{let X=$1(J.inputs[0].dataType);J.compute(y0(J.inputs[0],"QuickGelu",mq,lq(X,Q.alpha),Q.cacheKey,J.inputs[0].dataType))}}),MD=J0(()=>{Z0(),C0(),E3(),pq=(J)=>{if(J[0].dims.length!==3)throw Error("input should have 3 dimensions");if(![2560,5120,10240].includes(J[0].dims[2]))throw Error("hidden state should be 2560, 5120 or 10240");if(J[1].dims.length!==1)throw Error("bias is expected to have 1 dimensions");if(J[0].dims[2]!==J[1].dims[0])throw Error("last dimension of input and bias are not the same")},cq=(J)=>{let Q=J[0].dims.slice();Q[2]=Q[2]/2;let X=a("input",J[0].dataType,J[0].dims,4),Y=a("bias",J[0].dataType,[J[0].dims[2]],4),H=M0("output",J[0].dataType,Q,4),W=d.size(Q)/4,G=N1(J[0].dataType);return{name:"BiasSplitGelu",getRunData:()=>({outputs:[{dims:Q,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(W/64)}}),getShaderSource:(j)=>`
  const M_SQRT2 = sqrt(2.0);
  const halfChannels = ${J[0].dims[2]/4/2}u;

  ${j.declareVariables(X,Y,H)}

  ${f5(G)}

  ${j.mainStart()}
    ${j.guardAgainstOutOfBoundsWorkgroupSizes(W)}
    let biasIdx = global_idx % halfChannels;
    let batchIndex = global_idx / halfChannels;
    let inputOffset = biasIdx + batchIndex * halfChannels * 2;
    let valueLeft = input[inputOffset] + bias[biasIdx];
    let valueRight = input[inputOffset + halfChannels] + bias[biasIdx + halfChannels];
    let geluRight = valueRight * 0.5 * (erf_vf32(valueRight / M_SQRT2) + 1);

    ${H.setByOffset("global_idx","valueLeft * geluRight")}
  }`}},JN=(J)=>{pq(J.inputs),J.compute(cq(J.inputs))}}),BD=J0(()=>{A0(),Z0(),C0(),dq=(J,Q,X,Y,H,W,G,j,N,V,L,B)=>{let U,E;typeof j=="string"?U=E=(D,S)=>`${j}((${D}),(${S}))`:typeof j=="function"?U=E=j:(U=j.scalar,E=j.vector);let R=M0("outputData",L,Y.length,4),A=a("aData",N,Q.length,4),P=a("bData",V,X.length,4),z;if(H)if(W){let D=d.size(Q)===1,S=d.size(X)===1,w=Q.length>0&&Q[Q.length-1]%4===0,k=X.length>0&&X[X.length-1]%4===0;D||S?z=R.setByOffset("global_idx",E(D?`${A.type.value}(${A.getByOffset("0")}.x)`:A.getByOffset("global_idx"),S?`${P.type.value}(${P.getByOffset("0")}.x)`:P.getByOffset("global_idx"))):z=`
            let outputIndices = ${R.offsetToIndices("global_idx * 4u")};
            let offsetA = ${A.broadcastedIndicesToOffset("outputIndices",R)};
            let offsetB = ${P.broadcastedIndicesToOffset("outputIndices",R)};
            ${R.setByOffset("global_idx",E(G||w?A.getByOffset("offsetA / 4u"):`${A.type.value}(${A.getByOffset("offsetA / 4u")}[offsetA % 4u])`,G||k?P.getByOffset("offsetB / 4u"):`${P.type.value}(${P.getByOffset("offsetB / 4u")}[offsetB % 4u])`))}
          `}else z=R.setByOffset("global_idx",E(A.getByOffset("global_idx"),P.getByOffset("global_idx")));else{if(!W)throw Error("no necessary to use scalar implementation for element-wise binary op implementation.");let D=(S,w,k="")=>{let I=`aData[indexA${w}][componentA${w}]`,C=`bData[indexB${w}][componentB${w}]`;return`
            let outputIndices${w} = ${R.offsetToIndices(`global_idx * 4u + ${w}u`)};
            let offsetA${w} = ${A.broadcastedIndicesToOffset(`outputIndices${w}`,R)};
            let offsetB${w} = ${P.broadcastedIndicesToOffset(`outputIndices${w}`,R)};
            let indexA${w} = offsetA${w} / 4u;
            let indexB${w} = offsetB${w} / 4u;
            let componentA${w} = offsetA${w} % 4u;
            let componentB${w} = offsetB${w} % 4u;
            ${S}[${w}] = ${k}(${U(I,C)});
          `};L===9?z=`
            var data = vec4<u32>(0);
            ${D("data",0,"u32")}
            ${D("data",1,"u32")}
            ${D("data",2,"u32")}
            ${D("data",3,"u32")}
            outputData[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:z=`
            ${D("outputData[global_idx]",0)}
            ${D("outputData[global_idx]",1)}
            ${D("outputData[global_idx]",2)}
            ${D("outputData[global_idx]",3)}
          `}return`
        ${J.registerUniform("vec_size","u32").declareVariables(A,P,R)}

        ${B??""}

        ${J.mainStart()}
        ${J.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${z}
      }`},uq=(J,Q,X,Y,H,W,G=X.dataType)=>{let j=X.dims.map((A)=>Number(A)??1),N=Y.dims.map((A)=>Number(A)??1),V=!d.areEqual(j,N),L=j,B=d.size(j),U=!1,E=!1,R=[V];if(V){let A=J7.calcShape(j,N,!1);if(!A)throw Error("Can't perform binary op on the given tensors");L=A.slice(),B=d.size(L);let P=d.size(j)===1,z=d.size(N)===1,D=j.length>0&&j[j.length-1]%4===0,S=N.length>0&&N[N.length-1]%4===0;R.push(P),R.push(z),R.push(D),R.push(S);let w=1;for(let k=1;k<L.length;k++){let I=j[j.length-k],C=N[N.length-k];if(I===C)w*=I;else break}w%4===0?(E=!0,U=!0):(P||z||D||S)&&(U=!0)}else U=!0;return R.push(U),{name:J,shaderCache:{hint:Q+R.map((A)=>A.toString()).join("_"),inputDependencies:["rank","rank"]},getShaderSource:(A)=>dq(A,j,N,L,U,V,E,H,X.dataType,Y.dataType,G,W),getRunData:()=>({outputs:[{dims:L,dataType:G}],dispatchGroup:{x:Math.ceil(B/64/4)},programUniforms:[{type:12,data:Math.ceil(d.size(L)/4)},...O0(j,N,L)]})}},X6=(J,Q,X,Y,H,W)=>{J.compute(uq(Q,H??"",J.inputs[0],J.inputs[1],X,Y,W))},QN=(J)=>{X6(J,"Add",(Q,X)=>`${Q}+${X}`)},XN=(J)=>{X6(J,"Div",(Q,X)=>`${Q}/${X}`)},YN=(J)=>{X6(J,"Equal",{scalar:(Q,X)=>`u32(${Q}==${X})`,vector:(Q,X)=>`vec4<u32>(${Q}==${X})`},void 0,void 0,9)},HN=(J)=>{X6(J,"Mul",(Q,X)=>`${Q}*${X}`)},qN=(J)=>{let Q=a("input",J.inputs[0].dataType,J.inputs[0].dims).type.value;X6(J,"Pow",{scalar:(X,Y)=>`pow_custom(${X},${Y})`,vector:(X,Y)=>`pow_vector_custom(${X},${Y})`},`
    fn pow_custom(a : ${Q}, b : ${Q}) -> ${Q} {
      if (b == ${Q}(0.0)) {
        return ${Q}(1.0);
      } else if (a < ${Q}(0.0) && f32(b) != floor(f32(b))) {
        return ${Q}(pow(f32(a), f32(b))); // NaN
      }
      return select(sign(a), ${Q}(1.0), round(f32(abs(b) % ${Q}(2.0))) != 1.0) * ${Q}(${Q==="i32"?"round":""}(pow(f32(abs(a)), f32(b))));
    }
    fn pow_vector_custom(a : vec4<${Q}>, b : vec4<${Q}>) -> vec4<${Q}> {
      // TODO: implement vectorized pow
      return vec4<${Q}>(pow_custom(a.x, b.x), pow_custom(a.y, b.y), pow_custom(a.z, b.z), pow_custom(a.w, b.w));
    }
      `)},WN=(J)=>{X6(J,"Sub",(Q,X)=>`${Q}-${X}`)},GN=(J)=>{X6(J,"Greater",{scalar:(Q,X)=>`u32(${Q}>${X})`,vector:(Q,X)=>`vec4<u32>(${Q}>${X})`},void 0,void 0,9)},jN=(J)=>{X6(J,"Less",{scalar:(Q,X)=>`u32(${Q}<${X})`,vector:(Q,X)=>`vec4<u32>(${Q}<${X})`},void 0,void 0,9)},FN=(J)=>{X6(J,"GreaterOrEqual",{scalar:(Q,X)=>`u32(${Q}>=${X})`,vector:(Q,X)=>`vec4<u32>(${Q}>=${X})`},void 0,void 0,9)},NN=(J)=>{X6(J,"LessOrEqual",{scalar:(Q,X)=>`u32(${Q}<=${X})`,vector:(Q,X)=>`vec4<u32>(${Q}<=${X})`},void 0,void 0,9)}}),LD=J0(()=>{A0(),Z0(),J1(),C0(),oq=(J,Q)=>{if(!J||J.length<1)throw Error("too few inputs");let X=0,Y=J[X],H=Y.dataType,W=Y.dims.length;J.forEach((G,j)=>{if(j!==X){if(G.dataType!==H)throw Error("input tensors should be one type");if(G.dims.length!==W)throw Error("input tensors should have the same shape");G.dims.forEach((N,V)=>{if(V!==Q&&N!==Y.dims[V])throw Error("non concat dimensions must match")})}})},sq=(J,Q)=>`
  fn calculateInputIndex(index: u32) -> u32 {
    let sizeInConcatAxis = array<u32, ${J}u>(${Q});
    for (var i: u32 = 0u; i < ${J}; i += 1u ) {
      if (index < sizeInConcatAxis[i]) {
        return i;
      }
    }
    return ${J}u;
  }`,aq=(J,Q)=>{let X=J.length,Y=[];for(let H=0;H<X;++H){let W=Q.setByOffset("global_idx",J[H].getByIndices("indices"));X===1?Y.push(W):H===0?Y.push(`if (inputIndex == ${H}u) { ${W} }`):H===X-1?Y.push(`else { ${W} }`):Y.push(`else if (inputIndex == ${H}) { ${W} }`)}return Y.join(`
`)},iq=(J,Q,X,Y)=>{let H=d.size(X),W=Array(J.length),G=Array(J.length),j=0,N=[],V=[],L=[{type:12,data:H}];for(let A=0;A<J.length;++A)j+=J[A].dims[Q],W[A]=j,V.push(J[A].dims.length),G[A]=a(`input${A}`,Y,V[A]),N.push("rank"),L.push({type:12,data:W[A]});for(let A=0;A<J.length;++A)L.push(...O0(J[A].dims));L.push(...O0(X));let B=M0("output",Y,X.length),U=B.indicesGet("indices",Q),E=Array.from(Array(W.length).keys()).map((A)=>`uniforms.sizeInConcatAxis${A}`).join(","),R=(A)=>`

  ${(()=>{A.registerUniform("outputSize","u32");for(let P=0;P<J.length;P++)A.registerUniform(`sizeInConcatAxis${P}`,"u32");return A.declareVariables(...G,B)})()}

  ${sq(W.length,E)}

  ${A.mainStart()}
    ${A.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

    var indices = ${B.offsetToIndices("global_idx")};

    let inputIndex = calculateInputIndex(${U});
    if (inputIndex != 0u) {
      let sizeInConcatAxis = array<u32, ${W.length}u>(${E});
      ${U} -= sizeInConcatAxis[inputIndex - 1u];
    }

    ${aq(G,B)}
  }`;return{name:"Concat",shaderCache:{hint:`${Q}`,inputDependencies:N},getRunData:()=>({outputs:[{dims:X,dataType:Y}],dispatchGroup:{x:Math.ceil(H/64)},programUniforms:L}),getShaderSource:R}},VN=(J,Q)=>{let X=J.inputs,Y=X[0].dims,H=d.normalizeAxis(Q.axis,Y.length);oq(X,H);let W=Y.slice();W[H]=X.reduce((j,N)=>j+(N.dims.length>H?N.dims[H]:0),0);let G=X.filter((j)=>d.size(j.dims)>0);J.compute(iq(G,H,W,X[0].dataType),{inputs:G})},KN=(J)=>c0({axis:J.axis})}),v8=J0(()=>{A0(),Z0(),C8=(J,Q,X="f32")=>{switch(J.activation){case"Relu":return`value = max(value, ${Q}(0.0));`;case"Sigmoid":return`value = (${Q}(1.0) / (${Q}(1.0) + exp(-value)));`;case"Clip":return`value = clamp(value, ${Q}(${X}(uniforms.clip_min)), ${Q}(${X}(uniforms.clip_max)));`;case"HardSigmoid":return`value = max(${Q}(0.0), min(${Q}(1.0), ${X}(uniforms.alpha) * value + ${X}(uniforms.beta)));`;case"LeakyRelu":return`value = select(${X}(uniforms.alpha) * value, value, value >= ${Q}(0.0));`;case"Tanh":return`let e2x = exp(-2.0 * abs(value));
              value = sign(value) * (1.0 - e2x) / (1.0 + e2x);
        `;case"":return"";default:throw Error(`Unsupported activation ${J.activation}`)}},I8=(J,Q)=>{J.activation==="Clip"?Q.push({type:1,data:J.clipMax},{type:1,data:J.clipMin}):J.activation==="HardSigmoid"?Q.push({type:1,data:J.alpha},{type:1,data:J.beta}):J.activation==="LeakyRelu"&&Q.push({type:1,data:J.alpha})},_8=(J,Q)=>{J.activation==="Clip"?Q.push({name:"clip_max",type:"f32"},{name:"clip_min",type:"f32"}):J.activation==="HardSigmoid"?Q.push({name:"alpha",type:"f32"},{name:"beta",type:"f32"}):J.activation==="LeakyRelu"&&Q.push({name:"alpha",type:"f32"})},D3=(J)=>{let Q=J?.activation||"";if(Q==="HardSigmoid"){let[X,Y]=J?.activation_params||[0.2,0.5];return{activation:Q,alpha:X,beta:Y}}else if(Q==="Clip"){let[X,Y]=J?.activation_params||[pj,cj];return{activation:Q,clipMax:Y,clipMin:X}}else if(Q==="LeakyRelu"){let[X]=J?.activation_params||[0.01];return{activation:Q,alpha:X}}return{activation:Q}}}),A3=J0(()=>{M1=(J,Q)=>{switch(J){case 1:return Q;case 2:return`vec2<${Q}>`;case 3:return`vec3<${Q}>`;case 4:return`vec4<${Q}>`;default:throw Error(`${J}-component is not supported.`)}},MN=(J)=>`
      ${J?"value = value + getBiasByOutputCoords(coords);":""}
      `}),UD=J0(()=>{BN=(J)=>`
fn getIndexFromCoords4D(coords : vec4<i32>, shape : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
      shape.y * shape.z * shape.w, shape.z * shape.w, shape.w, 1));
}
fn getOutputIndexFromCoords(coords : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
    i32(${J}.x), i32(${J}.y), i32(${J}.z), 1));
}
`}),$3=J0(()=>{A0(),Z0(),C0(),v8(),T2=(J,Q,X,Y,H)=>{let W=Y-X;return`
      ${Array.from({length:X}).map((G,j)=>`
      if (${L0(Q.shape,j,Q.rank)} != 1) {
        ${Q.indicesSet(J,j,L0(H,j+W,Y))}
      } else {
        ${Q.indicesSet(J,j,0)}
      }`).join("")}
`},z3=(J,Q,X,Y,H=!1,W)=>{let G=J[0].dims,j=J[1].dims,N=G[G.length-2],V=j[j.length-1],L=G[G.length-1],B=t0(V),U=t0(L),E=t0(N),R=d.size(X)/B/E,A=J.length>2,P=Y?Y.slice(0,-2):X.slice(0,-2),z=[d.size(P),N,V],D=[{type:12,data:R},{type:12,data:N},{type:12,data:V},{type:12,data:L}];I8(Q,D),D.push(...O0(P,G,j)),A&&D.push(...O0(J[2].dims)),D.push(...O0(z));let S=(w)=>{let k=U3("batch_dims",J[0].dataType,P.length),I=a("a",J[0].dataType,G.length,U),C=a("b",J[1].dataType,j.length,B),T=M0("output",J[0].dataType,z.length,B),g=N1(T.type.tensor),m=C8(Q,T.type.value,g),l=[I,C],t="";if(A){let j0=H?B:1;l.push(a("bias",J[2].dataType,J[2].dims.length,j0)),t=`${H?`value += bias[col / ${j0}];`:`value += ${T.type.value}(bias[row + i]);`}`}let h=[{name:"output_size",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"}];_8(Q,h);let W0=()=>{let j0=`var a_data: ${I.type.value};`;for(let o=0;o<U;o++)j0+=`
              let b_data${o} = b[(b_offset + (k + ${o}) * uniforms.N + col) / ${B}];`;for(let o=0;o<E;o++){j0+=`a_data = a[(a_offset + (row + ${o}) * uniforms.K + k) / ${U}];`;for(let G0=0;G0<U;G0++)j0+=`
            values[${o}] = fma(${C.type.value}(a_data${U===1?"":`[${G0}]`}), b_data${G0}, values[${o}]);
`}return j0};return`
  ${w.registerUniforms(h).registerInternalVariables(k).declareVariables(...l,T)}
  ${w.mainStart()}
    ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let col = (global_idx % (uniforms.N / ${B})) * ${B};
    var index1 = global_idx / (uniforms.N / ${B});
    let stride1 = uniforms.M / ${E};
    let row = (index1 % stride1) * ${E};
    let batch = index1 / stride1;

    ${X.length===2?"":`let batch_indices = ${k.offsetToIndices("batch")};`}

    var a_indices: ${I.type.indices};
    ${T2("a_indices",I,I.rank-2,k.rank,"batch_indices")}
    ${I.indicesSet("a_indices",I.rank-2,0)}
    ${I.indicesSet("a_indices",I.rank-1,0)}
    let a_offset = ${I.indicesToOffset("a_indices")};

    var b_indices: ${C.type.indices};
    ${T2("b_indices",C,C.rank-2,k.rank,"batch_indices")}
    ${C.indicesSet("b_indices",C.rank-2,0)}
    ${C.indicesSet("b_indices",C.rank-1,0)}
    let b_offset = ${C.indicesToOffset("b_indices")};
    var values: array<${T.type.value}, ${E}>;
    for (var k: u32 = 0u; k < uniforms.K; k = k + ${U}) {
      ${W0()}
    }
    for (var i = 0u; i < ${E}u; i++) {
      var value = values[i];
      ${t}
      ${m}
      let cur_indices = ${T.type.indices}(batch, row + i, col);
      let offset = ${T.indicesToOffset("cur_indices")};
      ${T.setByOffset(`offset / ${B}`,"value")};
    }
  }
  `};return{name:"MatMulNaive",shaderCache:{hint:`${Q.activation};${B};${U};${E};${H}`,inputDependencies:A?["rank","rank","rank"]:["rank","rank"]},getRunData:()=>({outputs:[{dims:W?W(X):X,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(R/64)},programUniforms:D}),getShaderSource:S}}}),P3=J0(()=>{A0(),Z0(),C0(),v8(),$3(),A3(),nq=(J,Q)=>J?`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          kStart + inputRow,
          globalRowStart / innerElementSize + inputCol${Q?", batchIndices":""});
        `:`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          globalRow + innerRow,
          kStart / innerElementSize + inputCol${Q?", batchIndices":""});
        `,rq=(J,Q)=>J?`
        let ACached0 = mm_Asub[k * innerElementSize][localRow];
        let ACached1 = mm_Asub[k * innerElementSize + 1][localRow];
        let ACached2 = mm_Asub[k * innerElementSize + 2][localRow];
        ${Q===3?"":"let ACached3 = mm_Asub[k * innerElementSize + 3][localRow];"}
        for (var i = 0; i < rowPerThread; i = i + 1) {
          acc[i] = BCached0 * ACached0[i] + acc[i];
          acc[i] = BCached1 * ACached1[i] + acc[i];
          acc[i] = BCached2 * ACached2[i] + acc[i];
          ${Q===3?"":"acc[i] = BCached3 * ACached3[i] + acc[i];"}
        }`:`
        for (var i = 0; i < rowPerThread; i = i + 1) {
          let ACached = mm_Asub[tileRow + i][k];
          acc[i] = BCached0 * ACached.x + acc[i];
          acc[i] = BCached1 * ACached.y + acc[i];
          acc[i] = BCached2 * ACached.z + acc[i];
          ${Q===3?"":"acc[i] = BCached3 * ACached.w + acc[i];"}
        }`,iX=(J,Q,X="f32",Y,H=!1,W=32,G=!1,j=32)=>{let N=Q[1]*J[1],V=Q[0]*J[0],L=H?N:W,B=H?W:N,U=L/Q[0],E=W/Q[1];if(!((H&&U===4&&J[1]===4||!H&&(U===3||U===4))&&L%Q[0]===0&&W%Q[1]===0&&J[0]===4))throw Error(`If transposeA ${H} is true, innerElementSize ${U} and workPerThread[1] ${J[1]} must be 4.
      Otherwise, innerElementSize ${U} must be 3 or 4.
  tileAWidth ${L} must be divisible by workgroupSize[0]${Q[0]}. tileInner ${W} must be divisible by workgroupSize[1] ${Q[1]}. colPerThread ${J[0]} must be 4.`);return`
var<workgroup> mm_Asub: array<array<vec${U}<${X}>, ${L/U}>, ${B}>;
var<workgroup> mm_Bsub: array<array<vec4<${X}>, ${V/J[0]}>, ${W}>;

const rowPerThread = ${J[1]};
const colPerThread = ${J[0]};
const innerElementSize = ${U};
const tileInner = ${W};

@compute @workgroup_size(${Q[0]}, ${Q[1]}, ${Q[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
  let localRow = i32(localId.y);
  let tileRow = localRow * rowPerThread;
  let tileCol = i32(localId.x);

  let globalRow =i32(globalId.y) * rowPerThread;
  let globalCol = i32(globalId.x);
  let batch = ${G?"0":"i32(globalId.z)"};
  ${Y?`let batchIndices = ${Y.offsetToIndices("u32(batch)")};`:""}
  let globalRowStart = i32(workgroupId.y) * ${N};

  let num_tiles = ${G?`${Math.ceil(j/W)}`:"(uniforms.dim_inner - 1) / tileInner + 1"};
  var kStart = ${G?`i32(globalId.z) * ${j}`:"0"};

  var acc: array<vec4<${X}>, rowPerThread>;

  // Loop over shared dimension.
  let tileRowB = localRow * ${E};
  for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let inputRow = tileRow + innerRow;
          let inputCol = tileCol;
          ${nq(H,Y)}
      }

      // Load one tile of B into local memory.
      for (var innerRow = 0; innerRow < ${E}; innerRow = innerRow + 1) {
          let inputRow = tileRowB + innerRow;
          let inputCol = tileCol;
          mm_Bsub[inputRow][inputCol] = mm_readB(batch, kStart + inputRow, globalCol${Y?", batchIndices":""});
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      for (var k = 0; k < tileInner / innerElementSize; k = k + 1) {
          let BCached0 = mm_Bsub[k * innerElementSize][tileCol];
          let BCached1 = mm_Bsub[k * innerElementSize + 1][tileCol];
          let BCached2 = mm_Bsub[k * innerElementSize + 2][tileCol];
          ${U===3?"":"let BCached3 = mm_Bsub[k * innerElementSize + 3][tileCol];"}

          ${rq(H,U)}
      }

      workgroupBarrier();
  }

  for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      mm_write(batch, globalRow + innerRow, globalCol, acc[innerRow]);
  }
}`},VX=(J,Q)=>J?`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              kStart + inputRow,
              globalRowStart + inputCol${Q?", batchIndices":""});
            `:`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              globalRowStart + inputRow,
              kStart + inputCol${Q?", batchIndices":""});
            `,tq=(J)=>J?"let ACached = mm_Asub[k][tileRow + innerRow];":"let ACached = mm_Asub[tileRow + innerRow][k];",nX=(J,Q,X="f32",Y,H=!1,W=32,G=!1,j=32,N=!1)=>{let V=J[1]*Q[1],L=J[0]*Q[0],B=H?V:W,U=H?W:V;if(!(U%Q[1]===0&&B%Q[0]===0&&W%Q[1]===0))throw Error(`tileAHight ${U} must be divisible by workgroupSize[1]${Q[1]}, tileAWidth ${B} must be divisible by workgroupSize[0]${Q[0]}, tileInner ${W} must be divisible by workgroupSize[1]${Q[1]}`);let E=U/Q[1],R=B/Q[0],A=W/Q[1],P=N?`
    let localRow = i32(localId.y);
    let localCol = i32(localId.x);
    let globalRowStart = i32(workgroupId.y) * ${V};
    let globalColStart = i32(workgroupId.x) * ${L};

    // Loop over shared dimension.
    for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var inputRow = localRow; inputRow < ${U}; inputRow = inputRow + ${Q[1]}) {
        for (var inputCol = localCol; inputCol < ${B}; inputCol = inputCol + ${Q[0]}) {
          ${VX(H,Y)}
        }
      }
      // Load one tile of B into local memory.
      for (var inputRow = localRow; inputRow < ${W}; inputRow = inputRow + ${Q[1]}) {
            for (var inputCol = localCol; inputCol < ${L}; inputCol = inputCol + ${Q[0]}) {
          mm_Bsub[inputRow][inputCol] = mm_readB(batch,
            kStart + inputRow,
            globalColStart + inputCol${Y?", batchIndices":""});
        }
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      var BCached : array<${X}, colPerThread>;
      for (var k = 0; k < tileInner; k = k + 1) {
        for (var inner = 0; inner < colPerThread; inner = inner + 1) {
          BCached[inner] = mm_Bsub[k][localCol + inner * ${Q[0]}];
        }
        for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let ACached = ${H?`mm_Asub[k][localRow + innerRow * ${Q[1]}];`:`mm_Asub[localRow + innerRow * ${Q[1]}][k];`}
          for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
            acc[innerRow][innerCol] = acc[innerRow][innerCol] +
                ACached * BCached[innerCol];
          }
        }
      }
      workgroupBarrier();
    }
    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      let gRow = globalRowStart + localRow + innerRow * ${Q[1]};
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        let gCol = globalColStart + localCol + innerCol * ${Q[0]};
        mm_write(batch, gRow, gCol, acc[innerRow][innerCol]);
      }
    }
    `:`
let tileRow = i32(localId.y) * rowPerThread;
let tileCol = i32(localId.x) * colPerThread;

let globalRow = i32(globalId.y) * rowPerThread;
let globalCol = i32(globalId.x) * colPerThread;
let globalRowStart = i32(workgroupId.y) * ${V};

let tileRowA = i32(localId.y) * ${E};
let tileColA = i32(localId.x) * ${R};
let tileRowB = i32(localId.y) * ${A};
// Loop over shared dimension.
for (var t = 0; t < num_tiles; t = t + 1) {
  // Load one tile of A into local memory.
  for (var innerRow = 0; innerRow < ${E}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < ${R}; innerCol = innerCol + 1) {
      let inputRow = tileRowA + innerRow;
      let inputCol = tileColA + innerCol;
      ${VX(H,Y)}
    }
  }

  // Load one tile of B into local memory.
  for (var innerRow = 0; innerRow < ${A}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
      let inputRow = tileRowB + innerRow;
      let inputCol = tileCol + innerCol;
      mm_Bsub[inputRow][inputCol] = mm_readB(batch,
        kStart + inputRow,
        globalCol + innerCol${Y?", batchIndices":""});
    }
  }
  kStart = kStart + tileInner;
  workgroupBarrier();

  // Compute acc values for a single thread.
  var BCached : array<${X}, colPerThread>;
  for (var k = 0; k < tileInner; k = k + 1) {
    for (var inner = 0; inner < colPerThread; inner = inner + 1) {
      BCached[inner] = mm_Bsub[k][tileCol + inner];
    }

    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      ${tq(H)}
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        acc[innerRow][innerCol] = acc[innerRow][innerCol] + ACached * BCached[innerCol];
      }
    }
  }

  workgroupBarrier();
}

for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
  for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
    mm_write(batch, globalRow + innerRow, globalCol + innerCol,
        acc[innerRow][innerCol]);
  }
}
`;return`
  var<workgroup> mm_Asub : array<array<${X}, ${B}>, ${U}>;
  var<workgroup> mm_Bsub : array<array<${X}, ${L}>, ${W}>;
  const rowPerThread = ${J[1]};
  const colPerThread = ${J[0]};
  const tileInner = ${W};

@compute @workgroup_size(${Q[0]}, ${Q[1]}, ${Q[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
    let batch = ${G?"0":"i32(globalId.z)"};
    ${Y?`let batchIndices = ${Y.offsetToIndices("u32(batch)")};`:""}
    let num_tiles = ${G?`${Math.ceil(j/W)}`:"(uniforms.dim_inner - 1) / tileInner + 1"};
    var kStart = ${G?`i32(globalId.z) * ${j}`:"0"};

    var acc : array<array<${X}, colPerThread>, rowPerThread>;
    ${P}
  }
`},eq=(J,Q,X,Y,H=!1)=>{let[W,G,j,N]=Y,V=N1(Y[0].type.tensor);return`
    fn mm_readA(batch: i32, row: i32, colIn: i32, batchIndices: ${W.type.indices}) -> ${M1(J,V)} {
      var value = ${M1(J,V)}(0.0);
      let col = colIn * ${J};
      if(row < uniforms.dim_a_outer && col < uniforms.dim_inner)
      {
        var aIndices: ${G.type.indices};
        ${T2("aIndices",G,G.rank-2,W.rank,"batchIndices")}
        ${G.indicesSet("aIndices",G.rank-2,"u32(row)")}
        ${G.indicesSet("aIndices",G.rank-1,"u32(colIn)")}
        value = ${G.getByIndices("aIndices")};
      }
      return value;
    }

    fn mm_readB(batch: i32, row: i32, colIn: i32, batchIndices: ${W.type.indices}) -> ${M1(J,V)} {
      var value = ${M1(J,V)}(0.0);
      let col = colIn * ${J};
      if(row < uniforms.dim_inner && col < uniforms.dim_b_outer)
      {
        var bIndices: ${j.type.indices};
        ${T2("bIndices",j,j.rank-2,W.rank,"batchIndices")}
        ${j.indicesSet("bIndices",j.rank-2,"u32(row)")}
        ${j.indicesSet("bIndices",j.rank-1,"u32(colIn)")}
        value = ${j.getByIndices("bIndices")};
      }
      return value;
    }

    fn mm_write(batch: i32, row: i32, colIn: i32, valueIn: ${M1(J,V)}) {
      let col = colIn * ${J};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer) {
        var value = valueIn;
        let coords = vec3<i32>(batch, row, colIn);
        ${Q?`value = value + ${H?"bias[colIn]":`${M1(J,V)}(bias[row])`};`:""}
        ${X}
        ${N.setByIndices("vec3<u32>(coords)","value")}
      }
    }
    `},p5=(J,Q,X,Y,H=!1,W)=>{let G=J[0].dims,j=J[1].dims,N=G.slice(0,-2),V=j.slice(0,-2),L=Y?Y.slice(0,-2):X.slice(0,-2),B=d.size(L),U=G[G.length-2],E=G[G.length-1],R=j[j.length-1],A=E%4===0&&R%4===0,P=U<=8?[4,1,1]:[4,4,1],z=[8,8,1],D=[Math.ceil(R/z[0]/P[0]),Math.ceil(U/z[1]/P[1]),Math.ceil(B/z[2]/P[2])],S=A?4:1,w=[...N,U,E/S],k=w.length,I=[...V,E,R/S],C=I.length,T=[B,U,R/S],g=[{type:6,data:U},{type:6,data:R},{type:6,data:E}];I8(Q,g),g.push(...O0(L,w,I));let m=["rank","rank"],l=J.length>2;l&&(g.push(...O0(J[2].dims)),m.push("rank")),g.push(...O0(T));let t=(h)=>{let W0=L.length,j0=U3("batchDims",J[0].dataType,W0,1),o=N1(J[0].dataType),G0=a("a",J[0].dataType,k,S),F0=a("b",J[1].dataType,C,S),s=M0("result",J[0].dataType,T.length,S),N0=[G0,F0];if(l){let k0=H?S:1;N0.push(a("bias",J[2].dataType,J[2].dims.length,k0))}let f=[{name:"dim_a_outer",type:"i32"},{name:"dim_b_outer",type:"i32"},{name:"dim_inner",type:"i32"}];_8(Q,f);let p=N1(s.type.tensor),v=C8(Q,s.type.value,p),r=eq(S,l,v,[j0,G0,F0,s],H);return`
  ${h.registerUniforms(f).registerInternalVariables(j0).declareVariables(...N0,s)}
  ${r}
  ${A?iX(P,z,o,j0):nX(P,z,o,j0)}
                   `};return{name:"MatMul",shaderCache:{hint:`${P};${Q.activation};${A};${H}`,inputDependencies:m},getRunData:()=>({outputs:[{dims:W?W(X):X,dataType:J[0].dataType}],dispatchGroup:{x:D[0],y:D[1],z:D[2]},programUniforms:g}),getShaderSource:t}}}),OD=J0(()=>{A0(),x6(),C0(),v8(),A3(),UD(),P3(),JW=(J,Q,X,Y,H=!1,W,G=4,j=4,N=4,V="f32")=>{let L=(g)=>{switch(g){case 1:return"resData = x[xIndex];";case 3:return`resData = vec3<${V}>(x[xIndex], x[xIndex + 1], x[xIndex + 2]);`;case 4:return"resData = x[xIndex / 4];";default:throw Error(`innerElementSize ${g} is not supported.`)}},B=(g)=>{switch(g){case 1:return"return w[row * i32(uniforms.w_shape[3]) + colIn];";case 4:return"return w[row * i32(uniforms.w_shape[3]) / 4 + colIn];";default:throw Error(`innerElementSize ${g} is not supported.`)}},U=J?`
    let coord = vec4<i32>(batch, xRow, xCol, xCh);
    `:`
    let coord = vec4<i32>(batch, xCh, xRow, xCol);
    `,E=J?`
    let coords = vec4<i32>(
      batch,
      row / outWidth,
      row % outWidth,
      col);
    `:`
    let coords = vec4<i32>(
      batch,
      row,
      col / outWidth,
      col % outWidth);
    `,R=J?"i32(uniforms.x_shape[1])":"i32(uniforms.x_shape[2])",A=J?"i32(uniforms.x_shape[2])":"i32(uniforms.x_shape[3])",P=J?"row":"col",z=J?"col":"row",D=`
    let inChannels = i32(uniforms.w_shape[2]);
    let outWidth = ${J?"i32(uniforms.result_shape[2])":"i32(uniforms.result_shape[3])"};
    let outRow = ${P} / outWidth;
    let outCol = ${P} % outWidth;

    let WRow = ${z} / (i32(uniforms.w_shape[1]) * inChannels);
    let WCol = ${z} / inChannels % i32(uniforms.w_shape[1]);
    let xRow = outRow * uniforms.stride[0] + uniforms.dilation[0] * WRow - uniforms.pad[0];
    let xCol = outCol * uniforms.stride[1] + uniforms.dilation[1] * WCol - uniforms.pad[1];
    let xCh = ${z} % inChannels;
    var resData = ${M1(G,V)}(0.0);
    // The bounds checking is always needed since we use it to pad zero for
    // the 'same' padding type.
    if (xRow >= 0 && xRow < ${R} && xCol >= 0 && xCol < ${A}) {
      ${U}
      let xIndex = getIndexFromCoords4D(coord, vec4<i32>(uniforms.x_shape));
      ${L(G)}
    }
    return resData;`,S=J?Q&&Y?`
    let col = colIn * ${G};
    ${D}`:`
    let col = colIn * ${G};
    if (row < uniforms.dim_a_outer && col < uniforms.dim_inner) {
      ${D}
    }
    return ${M1(G,V)}(0.0);`:Y&&X?`
    let col = colIn * ${G};
    ${D}`:`
    let col = colIn * ${G};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${D}
    }
    return ${M1(G,V)}(0.0);`,w=J?Y&&X?B(j):`
    let col = colIn * ${j};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${B(j)}
    }
    return ${M1(j,V)}(0.0);`:`
    let col = colIn * ${j};
    if (row < uniforms.dim_inner && col < uniforms.dim_a_outer) {
      ${B(j)}
    }
    return ${M1(j,V)}(0.0);`,k=M1(N,V),I=J?M1(G,V):M1(j,V),C=J?M1(j,V):M1(G,V),T=C8(W,k,V);return`
    fn mm_readA(batch: i32, row : i32, colIn : i32) -> ${I} {
      ${J?S:w}
    }

    fn mm_readB(batch: i32, row : i32, colIn : i32) -> ${C} {
      ${J?w:S}
    }

    fn mm_write(batch: i32, row : i32, colIn : i32, valueIn : ${k}) {
      let col = colIn * ${N};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer)
      {
      var value = valueIn;
      let outWidth = ${J?"i32(uniforms.result_shape[2])":"i32(uniforms.result_shape[3])"};
      ${E}
      ${MN(H)}
      ${T}
      setOutputAtCoords(coords[0], coords[1], coords[2], coords[3], value);
      }
    }`},LN=(J,Q,X,Y,H,W,G,j,N)=>{let V=Q.format==="NHWC",L=V?J[0].dims[3]:J[0].dims[1],B=X[0],U=V?X[2]:X[3],E=V?X[1]:X[2],R=V?X[3]:X[1],A=V&&(L%4===0||L%3===0)&&R%4===0,P=V?R:U*E,z=V?U*E:R,D=[8,8,1],S=Y<=8?[4,1,1]:[4,4,1],w=[Math.ceil(P/D[0]/S[0]),Math.ceil(z/D[1]/S[1]),Math.ceil(B/D[2]/S[2])];x0("verbose",()=>`[conv2d_mm_webgpu] dispatch = ${w}`);let k=A?V&&L%4!==0?3:4:1,I=D[1]*S[1],C=D[0]*S[0],T=Math.max(D[0]*k,D[1]),g=Y%I===0,m=H%C===0,l=W%T===0,t=A?[k,4,4]:[1,1,1],h=[{type:6,data:Y},{type:6,data:H},{type:6,data:W},{type:6,data:[Q.pads[0],Q.pads[1]]},{type:6,data:Q.strides},{type:6,data:Q.dilations}];I8(Q,h),h.push(...O0(J[0].dims,J[1].dims));let W0=["rank","rank"];G&&(h.push(...O0(J[2].dims)),W0.push("rank")),h.push(...O0(X));let j0=(o)=>{let G0=[{name:"dim_a_outer",type:"i32"},{name:"dim_b_outer",type:"i32"},{name:"dim_inner",type:"i32"},{name:"pad",type:"i32",length:2},{name:"stride",type:"i32",length:2},{name:"dilation",type:"i32",length:2}];_8(Q,G0);let F0=A?4:1,s=N1(J[0].dataType),N0=`
      fn setOutputAtIndex(flatIndex : i32, value : ${A?`vec4<${s}>`:s}) {
        result[flatIndex] = ${A?`vec4<${s}>`:s}(value);
      }
      fn setOutputAtCoords(d0 : i32, d1 : i32, d2 : i32, d3 : i32, value : ${A?`vec4<${s}>`:s}) {
        let flatIndex = getOutputIndexFromCoords(vec4<i32>(d0, d1, d2, d3));
        setOutputAtIndex(flatIndex ${A?"/ 4":""}, value);
      }`,f=a("x",J[0].dataType,J[0].dims.length,k===3?1:k),p=a("w",J[1].dataType,J[1].dims.length,F0),v=[f,p],r=M0("result",J[0].dataType,X.length,F0);if(G){let k0=a("bias",J[2].dataType,J[2].dims.length,F0);v.push(k0),N0+=`
        fn getBiasByOutputCoords(coords : vec4<i32>) -> ${A?`vec4<${s}>`:s} {
          return bias[coords.${V?"w":"y"}${A?"/ 4":""}];
        }`}return`
        ${BN("uniforms.result_strides")}
        //struct Uniforms { xShape : vec4<i32>, wShape : vec4<i32>, outShape : vec4<i32>,
        //  outShapeStrides: vec3<i32>, filterDims : vec2<i32>, pad : vec2<i32>, stride : vec2<i32>,
        //  dilation : vec2<i32>, dimAOuter : i32, dimBOuter : i32, dimInner : i32 };
        ${o.registerUniforms(G0).declareVariables(...v,r)}
        ${N0}
        ${JW(V,g,m,l,G,Q,t[0],t[1],t[2],s)}
        ${A?iX(S,D,s,void 0,!V,T):nX(S,D,s,void 0,!V,T,!1,void 0,j)}`};return{name:"Conv2DMatMul",shaderCache:{hint:`${Q.cacheKey};${k};${A};${g};${m};${l};${I};${C};${T}`,inputDependencies:W0},getRunData:()=>({outputs:[{dims:N?N(X):X,dataType:J[0].dataType}],dispatchGroup:{x:w[0],y:w[1],z:w[2]},programUniforms:h}),getShaderSource:j0}}}),RD=J0(()=>{A0(),x6(),Z0(),C0(),v8(),A3(),QW=(J)=>{let Q=1;for(let X=0;X<J.length;X++)Q*=J[X];return Q},KX=(J)=>typeof J=="number"?[J,J,J]:J,S2=(J,Q)=>Q<=1?J:J+(J-1)*(Q-1),XW=(J,Q,X,Y=1)=>{let H=S2(Q,Y);return Math.floor((J[0]*(X-1)-X+H)/2)},MX=(J,Q,X,Y,H)=>{H==null&&(H=XW(J,Q[0],Y[0]));let W=[0,0,0,X];for(let G=0;G<3;G++)J[G]+2*H>=Q[G]&&(W[G]=Math.trunc((J[G]-Q[G]+2*H)/Y[G]+1));return W},YW=(J,Q,X,Y,H,W,G,j,N,V)=>{let L,B,U,E;if(J==="VALID"&&(J=0),typeof J=="number"){L={top:J,bottom:J,left:J,right:J,front:J,back:J};let R=MX([Q,X,Y,1],[j,N,V],1,[H,W,G],J);B=R[0],U=R[1],E=R[2]}else if(Array.isArray(J)){if(!J.every((A,P,z)=>A===z[0]))throw Error(`Unsupported padding parameter: ${J}`);L={top:J[0],bottom:J[1],left:J[2],right:J[3],front:J[4],back:J[5]};let R=MX([Q,X,Y,1],[j,N,V],1,[H,W,G],J[0]);B=R[0],U=R[1],E=R[2]}else if(J==="SAME_UPPER"){B=Math.ceil(Q/H),U=Math.ceil(X/W),E=Math.ceil(Y/G);let R=(B-1)*H+j-Q,A=(U-1)*W+N-X,P=(E-1)*G+V-Y,z=Math.floor(R/2),D=R-z,S=Math.floor(A/2),w=A-S,k=Math.floor(P/2),I=P-k;L={top:S,bottom:w,left:k,right:I,front:z,back:D}}else throw Error(`Unknown padding parameter: ${J}`);return{padInfo:L,outDepth:B,outHeight:U,outWidth:E}},UN=(J,Q,X,Y,H,W=!1,G="channelsLast")=>{let j,N,V,L,B;if(G==="channelsLast")[j,N,V,L,B]=J;else if(G==="channelsFirst")[j,B,N,V,L]=J;else throw Error(`Unknown dataFormat ${G}`);let[U,,E,R,A]=Q,[P,z,D]=KX(X),[S,w,k]=KX(Y),I=S2(E,S),C=S2(R,w),T=S2(A,k),{padInfo:g,outDepth:m,outHeight:l,outWidth:t}=YW(H,N,V,L,P,z,D,I,C,T),h=W?U*B:U,W0=[0,0,0,0,0];return G==="channelsFirst"?W0=[j,h,m,l,t]:G==="channelsLast"&&(W0=[j,m,l,t,h]),{batchSize:j,dataFormat:G,inDepth:N,inHeight:V,inWidth:L,inChannels:B,outDepth:m,outHeight:l,outWidth:t,outChannels:h,padInfo:g,strideDepth:P,strideHeight:z,strideWidth:D,filterDepth:E,filterHeight:R,filterWidth:A,effectiveFilterDepth:I,effectiveFilterHeight:C,effectiveFilterWidth:T,dilationDepth:S,dilationHeight:w,dilationWidth:k,inShape:J,outShape:W0,filterShape:Q}},ON=(J,Q,X,Y,H,W)=>{let G=W==="channelsLast",j=G?J[0].dims[3]:J[0].dims[1],N=!1,V=[64,1,1],L={x:X.map((D,S)=>S)},B=[Math.ceil(QW(L.x.map((D)=>X[D]))/V[0]),1,1];x0("verbose",()=>`[conv3d_naive_webgpu] dispatch = ${B}`);let U=N?G&&j%4!==0?3:4:1,E=d.size(X),R=[{type:12,data:E},{type:12,data:Y},{type:12,data:H},{type:12,data:Q.strides},{type:12,data:Q.dilations}];I8(Q,R),R.push(...O0(J[0].dims,J[1].dims));let A=["rank","rank"],P=J.length===3;P&&(R.push(...O0(J[2].dims)),A.push("rank")),R.push(...O0(X));let z=(D)=>{let S=[{name:"output_size",type:"u32"},{name:"filter_dims",type:"u32",length:Y.length},{name:"pads",type:"u32",length:H.length},{name:"strides",type:"u32",length:Q.strides.length},{name:"dilations",type:"u32",length:Q.dilations.length}];_8(Q,S);let w=N?4:1,k=N1(J[0].dataType),I=a("x",J[0].dataType,J[0].dims.length,U===3?1:U),C=a("W",J[1].dataType,J[1].dims.length,w),T=[I,C],g=M0("result",J[0].dataType,X.length,w),m="";if(P){let h=a("bias",J[2].dataType,J[2].dims.length,w);T.push(h),m+=`
        fn getBiasByOutputCoords(coords : array<u32, 5>) -> ${N?`vec4<${k}>`:k} {
          return bias[${G?L0("coords",4,5):L0("coords",1,5)}${N?"/ 4":""}];
        }`}let l=M1(U,k),t=C8(Q,l,k);return`
            ${m}
            fn getX(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> f32 {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${I.getByIndices("aIndices")};
            }
            fn getW(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> f32 {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${C.getByIndices("aIndices")};
            }
          ${D.registerUniforms(S).declareVariables(...T,g)}
          ${D.mainStart()}
          ${D.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
              let coords = ${g.offsetToIndices("global_idx")};
              let batch = ${L0("coords",0,I.rank)};
              let d2 = ${G?L0("coords",I.rank-1,I.rank):L0("coords",1,I.rank)};
              let xFRCCorner = vec3<u32>(${G?L0("coords",1,I.rank):L0("coords",2,I.rank)},
              ${G?L0("coords",2,I.rank):L0("coords",3,I.rank)},
              ${G?L0("coords",3,I.rank):L0("coords",4,I.rank)}) * uniforms.strides - uniforms.pads;
              let xFCorner = xFRCCorner.x;
              let xRCorner = xFRCCorner.y;
              let xCCorner = xFRCCorner.z;
              let xShapeY = ${G?L0("uniforms.x_shape",1,I.rank):L0("uniforms.x_shape",2,I.rank)};
              let xShapeZ = ${G?L0("uniforms.x_shape",2,I.rank):L0("uniforms.x_shape",3,I.rank)};
              let xShapeW = ${G?L0("uniforms.x_shape",3,I.rank):L0("uniforms.x_shape",4,I.rank)};
              let xShapeU = ${G?L0("uniforms.x_shape",4,I.rank):L0("uniforms.x_shape",1,I.rank)};
              let inputDepthNearestVec4 = (xShapeU / 4) * 4;
              let inputDepthVec4Remainder = xShapeU % 4;

              var value = 0.0;
              for (var wF = 0u; wF < uniforms.filter_dims[0]; wF++) {
                let xF = xFCorner + wF * uniforms.dilations[0];
                if (xF < 0 || xF >= xShapeY) {
                  continue;
                }

                for (var wR = 0u; wR < uniforms.filter_dims[1]; wR++) {
                  let xR = xRCorner + wR * uniforms.dilations[1];
                  if (xR < 0 || xR >= xShapeZ) {
                    continue;
                  }

                  for (var wC = 0u; wC < uniforms.filter_dims[2]; wC++) {
                    let xC = xCCorner + wC * uniforms.dilations[2];
                    if (xC < 0 || xC >= xShapeW) {
                      continue;
                    }

                    for (var d1 = 0u; d1 < inputDepthNearestVec4; d1 += 4) {
                      ${G?`let xValues = vec4<f32>(
                               getX(batch, xF, xR, xC, d1),
                               getX(batch, xF, xR, xC, d1 + 1),
                               getX(batch, xF, xR, xC, d1 + 2),
                               getX(batch, xF, xR, xC, d1 + 3));
                            `:`let xValues = vec4<f32>(
                               getX(batch, d1, xF, xR, xC),
                               getX(batch, d1 + 1, xF, xR, xC),
                               getX(batch, d1 + 2, xF, xR, xC),
                               getX(batch, d1 + 3, xF, xR, xC));
                            `}
                            let wValues = vec4<f32>(
                              getW(d2, d1, wF, wR, wC),
                              getW(d2, d1 + 1, wF, wR, wC),
                              getW(d2, d1 + 2, wF, wR, wC),
                              getW(d2, d1 + 3, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                    if (inputDepthVec4Remainder == 1) {
                        ${G?`value += getX(batch, xF, xR, xC, inputDepthNearestVec4)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`:`value += getX(batch, inputDepthNearestVec4, xF, xR, xC)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`}
                    } else if (inputDepthVec4Remainder == 2) {
                      ${G?`let xValues = vec2<f32>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1));
                      `:`let xValues = vec2<f32>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC));
                    `}
                    let wValues = vec2<f32>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC));
                      value += dot(xValues, wValues);
                    } else if (inputDepthVec4Remainder == 3) {
                      ${G?`let xValues = vec3<f32>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 2));
                      `:`let xValues = vec3<f32>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 2, xF, xR, xC));
                    `}
                    let wValues = vec3<f32>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 2, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                  }
                }
              }
              ${P?"value = value + getBiasByOutputCoords(coords)":""};
              ${t}
              result[global_idx] = f32(value);
          }`};return{name:"Conv3DNaive",shaderCache:{hint:`${Q.cacheKey};${G};${U};${P}`,inputDependencies:A},getRunData:()=>({outputs:[{dims:X,dataType:J[0].dataType}],dispatchGroup:{x:B[0],y:B[1],z:B[2]},programUniforms:R}),getShaderSource:z}}}),ED=J0(()=>{A0(),Z0(),C0(),v8(),RN=(J,Q,X,Y)=>{let H=J.length>2,W=H?"value += b[output_channel];":"",G=J[0].dims,j=J[1].dims,N=Q.format==="NHWC",V=N?X[3]:X[1],L=V/Q.group,B=N&&L>=4?t0(V):1,U=d.size(X)/B,E=[{type:12,data:U},{type:12,data:Q.dilations},{type:12,data:[Q.strides[0],Q.strides[1]]},{type:12,data:[Q.pads[0],Q.pads[1]]},{type:12,data:L}];I8(Q,E),E.push(...O0(G,[j[0],j[1],j[2],j[3]/B]));let R=H?["rank","rank","rank"]:["rank","rank"];E.push(...O0([X[0],X[1],X[2],X[3]/B]));let A=(P)=>{let z=M0("output",J[0].dataType,X.length,B),D=N1(z.type.tensor),S=C8(Q,z.type.value,D),w=a("x",J[0].dataType,G.length),k=a("w",J[1].dataType,j.length,B),I=[w,k];H&&I.push(a("b",J[2].dataType,J[2].dims,B));let C=[{name:"output_size",type:"u32"},{name:"dilations",type:"u32",length:Q.dilations.length},{name:"strides",type:"u32",length:2},{name:"pads",type:"u32",length:2},{name:"output_channels_per_group",type:"u32"}];_8(Q,C);let T=N?`
      for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[0]; wHeight++) {
        let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

        if (xHeight < 0u || xHeight >= uniforms.x_shape[1]) {
          continue;
        }

        for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[1]; wWidth++) {
          let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
          if (xWidth < 0u || xWidth >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[2]; wInChannel++) {
            let input_channel = in_channel_offset + wInChannel;
            let xVal = ${w.get("batch","xHeight","xWidth","input_channel")};
            let wVal = ${k.get("wHeight","wWidth","wInChannel","output_channel")};
            value += xVal * wVal;
          }
        }
      }
      `:`
      for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[1]; wInChannel++) {
        let input_channel = in_channel_offset + wInChannel;
        for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[2]; wHeight++) {
          let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

          if (xHeight < 0u || xHeight >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[3]; wWidth++) {
            let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
            if (xWidth < 0u || xWidth >= uniforms.x_shape[3]) {
              continue;
            }

            let xVal = ${w.get("batch","input_channel","xHeight","xWidth")};
            let wVal = ${k.get("output_channel","wInChannel","wHeight","wWidth")};
            value += xVal * wVal;
          }
        }
      }
      `;return`
  ${P.registerUniforms(C).declareVariables(...I,z)}

  ${P.mainStart()}
    ${P.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let outputIndices = ${z.offsetToIndices("global_idx")};
    let batch: u32 = outputIndices[0];
    let output_channel: u32 = outputIndices[${N?3:1}];
    let xRCCorner: vec2<u32> = vec2<u32>(outputIndices[${N?1:2}], outputIndices[${N?2:3}]) * uniforms.strides - uniforms.pads;
    let group_id: u32 = output_channel * ${B} / uniforms.output_channels_per_group;
    var in_channel_offset = group_id * uniforms.w_shape[${N?2:1}];

    var value: ${z.type.value} = ${z.type.value}(0);
    ${T}
    ${W}
    ${S}
    ${z.setByOffset("global_idx","value")}
  }`};return{name:"GroupedConv",shaderCache:{hint:`${Q.cacheKey}_${B}`,inputDependencies:R},getRunData:()=>({outputs:[{dims:Y?Y(X):X,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(U/64)},programUniforms:E}),getShaderSource:A}},EN=(J,Q,X,Y)=>{let H=J.length>2,W=t0(X[3]),G=t0(X[2]),j=d.size(X)/W/G,N=[J[0].dims[0],J[0].dims[1],J[0].dims[2],J[0].dims[3]/W],V=[J[1].dims[0],J[1].dims[1],J[1].dims[2],J[1].dims[3]/W],L=[X[0],X[1],X[2],X[3]/W],B=[{type:12,data:j},{type:6,data:[Q.strides[0],Q.strides[1]]},{type:6,data:[Q.pads[0],Q.pads[1]]}];I8(Q,B),B.push(...O0(N,V,L));let U=(G-1)*Q.strides[1]+V[1],E=(R)=>{let A=M0("output",J[0].dataType,L.length,W),P=N1(A.type.tensor),z=C8(Q,A.type.value,P),D=a("x",J[0].dataType,N.length,W),S=a("w",J[1].dataType,V.length,W),w=[D,S];H&&w.push(a("b",J[2].dataType,J[2].dims,W));let k=H?"value += b[output_channel];":"",I=[{name:"output_size",type:"u32"},{name:"strides",type:"i32",length:2},{name:"pads",type:"i32",length:2}];return _8(Q,I),`
  ${R.registerUniforms(I).declareVariables(...w,A)}
  ${R.mainStart()}
    ${R.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let width0 = uniforms.output_shape[3];
    let output_channel = global_idx % width0;
    var index1 = global_idx / width0;
    let width1 = uniforms.output_shape[2] / ${G}u;
    let col = (index1 % width1) * ${G}u;
    index1 = index1 / width1;
    let row = index1 % uniforms.output_shape[1];
    let batch = index1 / uniforms.output_shape[1];

    let x_corner = vec2<i32>(i32(row), i32(col)) * uniforms.strides - uniforms.pads;

    var x_vals: array<${D.type.value}, ${U}>;
    var values: array<${A.type.value}, ${G}>;
    let input_channel = output_channel;
    // Use constant instead of uniform can give better performance for w's height/width.
    for (var w_height: u32 = 0u; w_height < ${V[0]}; w_height++) {
      let x_height = x_corner.x + i32(w_height);
      if (x_height >= 0 && u32(x_height) < uniforms.x_shape[1]) {
        for (var i = 0; i < ${U}; i++) {
          let x_width = x_corner.y + i;
          if (x_width >= 0 && u32(x_width) < uniforms.x_shape[2]) {
            x_vals[i] = ${D.get("batch","u32(x_height)","u32(x_width)","input_channel")};
          } else {
            x_vals[i] = ${D.type.value}(0);
          }
        }
        for (var w_width: u32 = 0u; w_width < ${V[1]}; w_width++) {
          let w_val = ${S.get("w_height","w_width","0","output_channel")};
          for (var i = 0u; i < ${G}u; i++) {
            values[i] = fma(x_vals[i * u32(uniforms.strides[1]) + w_width], w_val, values[i]);
          }
        }
      }
    }

    for (var i = 0u; i < ${G}u; i++) {
      var value = values[i];
      ${k}
      ${z}
      ${A.set("batch","row","col + i","output_channel","value")};
    }
  }`};return{name:"GroupedConv-Vectorize",shaderCache:{hint:`${Q.cacheKey};${W};${G};${U};${V[0]};${V[1]}`,inputDependencies:H?["rank","rank","type"]:["rank","rank"]},getRunData:()=>({outputs:[{dims:Y?Y(X):X,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(j/64)},programUniforms:B}),getShaderSource:E}}}),DD=J0(()=>{Z0(),OD(),RD(),P3(),ED(),v8(),$3(),u6(),HW=(J,Q,X,Y,H,W)=>{let G=J[0],j=J.slice(W?1:2,W?3:4),N=j.length,V=Q[0],L=Q.slice(2).map((U,E)=>U+(U-1)*(X[E]-1)),B=j.map((U,E)=>U+Y[E]+Y[E+N]).map((U,E)=>Math.floor((U-L[E]+H[E])/H[E]));return B.splice(0,0,G),B.splice(W?3:1,0,V),B},C5=[2,3,1,0],qW=(J,Q)=>{if(!J||J.length!==2&&J.length!==3)throw Error("Conv requires 2 or 3 inputs");if(J[0].dims.length>5)throw Error("greater than 5D is not supported");if(J[0].dims.length!==J[1].dims.length)throw Error("filter does not have same dimension as input");let X=J[0].dims[Q.format==="NHWC"?J[0].dims.length-1:1],Y=J[1].dims[1]*Q.group;if(X!==Y)throw Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");if(J.length===3&&(J[2].dims.length!==1||J[1].dims[0]!==J[2].dims[0]))throw Error("invalid bias");let H=J[0].dims.length-2;if(Q.dilations.length!==H)throw Error(`dilations should be ${H}D`);if(Q.strides.length!==H)throw Error(`strides should be ${H}D`);if(Q.pads.length!==H*2)throw Error(`pads should be ${H*2}D`);if(Q.kernelShape.length!==0&&Q.kernelShape.length!==J[1].dims.length-2)throw Error("invalid kernel shape")},I5=(J,Q)=>{let X=J.kernelShape.slice();X.length<Q[1].dims.length-2&&X.push(...Array(Q[1].dims.length-2-X.length).fill(0));for(let W=2;W<Q[1].dims.length;++W)X[W-2]===0&&(X[W-2]=Q[1].dims[W]);let Y=J.pads.slice();l5.adjustPadsBasedOnAutoPad(Q[0].dims,J.strides,J.dilations,X,Y,J.format==="NHWC",J.autoPad);let H=Object.assign({},J);return Object.assign(H,{kernelShape:X,pads:Y}),H},rX=(J)=>{let Q=D3(J),X=J.format,Y=["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][J.auto_pad],H=J.dilations,W=J.group,G=J.kernel_shape,j=J.pads,N=J.strides,V=J.w_is_const();return{autoPad:Y,format:X,dilations:H,group:W,kernelShape:G,pads:j,strides:N,wIsConst:V,...Q,cacheKey:`${J.format};${Q.activation};`}},BX=(J,Q,X,Y)=>{let H=X.format==="NHWC",W=HW(Q[0].dims,Q[1].dims,X.dilations,X.pads,X.strides,H);if(X.group!==1){let I=[Q[0]];if(H){let C=J.kernelCustomData.wT??J.compute(x1(Q[1],C5),{inputs:[1],outputs:[X.wIsConst?-2:-1]})[0];X.wIsConst&&!J.kernelCustomData.wT&&(J.kernelCustomData.wT=C),I.push(C)}else I.push(Q[1]);Q.length===3&&I.push(Q[2]),!J.adapterInfo.isArchitecture("ampere")&&H&&Q[1].dims[0]===X.group&&Q[1].dims[1]===1&&X.dilations[0]===1&&X.dilations[1]===1?J.compute(EN(I,X,W,Y),{inputs:I}):J.compute(RN(I,X,W,Y),{inputs:I});return}let G=Q.length===3,j=Q[0].dims[H?1:2],N=Q[0].dims[H?2:3],V=Q[0].dims[H?3:1],L=Q[1].dims[2],B=Q[1].dims[3],U=W[H?1:2],E=W[H?2:3],R=W[H?3:1],A=H&&L===j&&B===N&&X.pads[0]===0&&X.pads[1]===0;if(A||L===1&&B===1&&X.dilations[0]===1&&X.dilations[1]===1&&X.strides[0]===1&&X.strides[1]===1&&X.pads[0]===0&&X.pads[1]===0){let I=W[0],C,T,g,m=[];if(H){let h=J.kernelCustomData.wT??J.compute(x1(Q[1],C5),{inputs:[1],outputs:[X.wIsConst?-2:-1]})[0];if(X.wIsConst&&!J.kernelCustomData.wT&&(J.kernelCustomData.wT=h),A){let W0=j*N*V;C=Q[0].reshape([1,I,W0]),T=h.reshape([1,W0,R]),g=[1,I,R]}else C=Q[0].reshape([I,j*N,V]),T=h.reshape([1,V,R]),g=[I,U*E,R];m.push(C),m.push(T)}else C=Q[0].reshape([I,V,j*N]),T=Q[1].reshape([1,R,V]),g=[I,R,U*E],m.push(T),m.push(C);G&&m.push(Q[2]);let l=g[2],t=m[0].dims[m[0].dims.length-1];l<8&&t<8?J.compute(z3(m,X,W,g,H,Y),{inputs:m}):J.compute(p5(m,X,W,g,H,Y),{inputs:m});return}let P=!0,z=J.kernelCustomData.wT??J.compute(x1(Q[1],C5),{inputs:[1],outputs:[X.wIsConst?-2:-1]})[0];X.wIsConst&&!J.kernelCustomData.wT&&(J.kernelCustomData.wT=z);let D=[Q[0],z];G&&D.push(Q[2]);let S=H?U*E:R,w=H?R:U*E,k=L*B*V;J.compute(LN(D,X,W,S,w,k,G,P,Y),{inputs:D})},WW=(J,Q)=>{let X=Q.format==="NHWC",Y=[J.inputs[0].reshape(X?[J.inputs[0].dims[0],1,J.inputs[0].dims[1],J.inputs[0].dims[2]]:[J.inputs[0].dims[0],J.inputs[0].dims[1],1,J.inputs[0].dims[2]]),J.inputs[1].reshape([J.inputs[1].dims[0],J.inputs[1].dims[1],1,J.inputs[1].dims[2]])];J.inputs.length===3&&Y.push(J.inputs[2]);let H=[0,Q.pads[0],0,Q.pads[1]],W=[1].concat(Q.strides),G=[1].concat(Q.dilations),j=[1].concat(Q.kernelShape),N=I5({...Q,pads:H,strides:W,dilations:G,kernelShape:j},Y);BX(J,Y,N,(V)=>X?[V[0],V[2],V[3]]:[V[0],V[1],V[3]])},GW=(J,Q,X)=>{let Y=X.format==="NHWC"?"channelsLast":"channelsFirst",H=I5(X,Q),W=X.autoPad==="NOTSET"?X.pads:X.autoPad,G=UN(Q[0].dims,Q[1].dims,X.strides,X.dilations,W,!1,Y);J.compute(ON(Q,H,G.outShape,[G.filterDepth,G.filterHeight,G.filterWidth],[G.padInfo.front,G.padInfo.top,G.padInfo.left],Y))},tX=(J,Q)=>{if(qW(J.inputs,Q),J.inputs[0].dims.length===3)WW(J,Q);else if(J.inputs[0].dims.length===5)GW(J,J.inputs,Q);else{let X=I5(Q,J.inputs);BX(J,J.inputs,X)}}}),AD=J0(()=>{A0(),x6(),Z0(),C0(),DN=(J,Q,X)=>{let Y=J.length>2,H=Q.outputShape,W=Q.format==="NHWC",G=Q.group,j=J[1].dims,N=j[2]/G,V=j[3],L=W?t0(N):1,B=W?t0(V):1,U=W?V===1?L:B:1,E=d.size(H)/B,R=[Math.ceil(E/64),1,1];x0("verbose",()=>`[conv2d_backprop_webgpu] dispatch = ${R}`);let A=["rank","rank"],P=[Q.strides[0],Q.strides[1]],z=[Q.kernelShape[W?1:2],Q.kernelShape[W?2:3]],D=[Q.dilations[0],Q.dilations[1]],S=[z[0]+(Q.dilations[0]<=1?0:(Q.kernelShape[W?1:2]-1)*(Q.dilations[0]-1)),z[1]+(Q.dilations[1]<=1?0:(Q.kernelShape[W?2:3]-1)*(Q.dilations[1]-1))],w=[S[0]-1-Math.floor((Q.pads[0]+Q.pads[2])/2),S[1]-1-Math.floor((Q.pads[1]+Q.pads[3])/2)],k=[{type:12,data:E},{type:12,data:P},{type:12,data:z},{type:12,data:D},{type:12,data:S},{type:6,data:w},{type:12,data:N},{type:12,data:V},...O0(J[0].dims,J[1].dims)];Y&&(k.push(...O0(J[2].dims)),A.push("rank")),k.push(...O0(H));let I=(C)=>{let T=[{name:"output_size",type:"u32"},{name:"strides",type:"u32",length:P.length},{name:"filter_dims",type:"u32",length:z.length},{name:"dilations",type:"u32",length:z.length},{name:"effective_filter_dims",type:"u32",length:S.length},{name:"pads",type:"i32",length:w.length},{name:"input_channels_per_group",type:"u32"},{name:"output_channels_per_group",type:"u32"}],g=N1(J[0].dataType),m=W?1:2,l=W?2:3,t=W?3:1,h=a("W",J[1].dataType,J[1].dims.length,U),W0=a("Dy",J[0].dataType,J[0].dims.length,L),j0=[W0,h];Y&&j0.push(a("bias",J[2].dataType,[H[t]].length,B));let o=M0("result",J[0].dataType,H.length,B),G0=()=>{let s="";if(L===1)s+=`
        let w_offset = ${h.indicesToOffset(`${h.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel, wOutChannel)`)};
        let wValue = ${h.getByOffset(`w_offset / ${U}`)};
        dotProd = dotProd + xValue * wValue;`;else if(V===1)s+=`
          let wValue = ${h.getByOffset(`${h.indicesToOffset(`${h.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel, wOutChannel)`)} / ${U}`)};
          dotProd = dotProd + dot(xValue, wValue);`;else for(let N0=0;N0<L;N0++)s+=`
            let wValue${N0} = ${h.getByOffset(`${h.indicesToOffset(`${h.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel + ${N0}, wOutChannel)`)} / ${U}`)};
            dotProd = dotProd + xValue[${N0}] * wValue${N0};`;return s},F0=`
            let outputIndices = ${o.offsetToIndices(`global_idx * ${B}`)};
            let batch = ${o.indicesGet("outputIndices",0)};
            let d1 = ${o.indicesGet("outputIndices",t)};
            let r = ${o.indicesGet("outputIndices",m)};
            let c = ${o.indicesGet("outputIndices",l)};
            let dyCorner = vec2<i32>(i32(r), i32(c)) - uniforms.pads;
            let dyRCorner = dyCorner.x;
            let dyCCorner = dyCorner.y;
            let groupId = d1 / uniforms.output_channels_per_group;
            let wOutChannel = d1 - groupId * uniforms.output_channels_per_group;
            // Convolve dy(?, ?, d2) with w(:, :, d1, d2) to compute dx(xR, xC, d1).
            // ? = to be determined. : = across all values in that axis.
            var dotProd = ${o.type.value}(0.0);
            var wR: u32 = 0;
            if (uniforms.dilations.x == 1) {
              // Minimum wR >= 0 that satisfies (dyRCorner + wR) % (uniforms.strides.x) == 0
              wR = u32(((dyRCorner + i32(uniforms.strides.x) - 1) / i32(uniforms.strides.x)) * i32(uniforms.strides.x) - dyRCorner);
            }
            for (; wR < uniforms.effective_filter_dims.x; wR = wR + 1) {
              if (wR % uniforms.dilations.x != 0) {
                continue;
              }
              let dyR = (${g}(dyRCorner) + ${g}(wR)) / ${g}(uniforms.strides[0]);
              let wRPerm = uniforms.filter_dims.x - 1 - wR / uniforms.dilations.x;
              if (dyR < 0.0 || dyR >= ${g}(uniforms.Dy_shape[${m}]) || fract(dyR) > 0.0 ||
                  wRPerm < 0) {
                continue;
              }
              let idyR: u32 = u32(dyR);
              var wC: u32 = 0;
              if (uniforms.dilations.y == 1) {
                // Minimum wC >= 0 that satisfies (dyCCorner + wC) % (uniforms.strides.y) == 0
                wC = u32(((dyCCorner + i32(uniforms.strides.y) - 1) / i32(uniforms.strides.y)) * i32(uniforms.strides.y) - dyCCorner);
              }

              for (; wC < uniforms.effective_filter_dims.y; wC = wC + 1) {
                if (wC % uniforms.dilations.y != 0) {
                  continue;
                }
                let dyC = (${g}(dyCCorner) + ${g}(wC)) / ${g}(uniforms.strides.y);
                let wCPerm = uniforms.filter_dims.y - 1 - wC / uniforms.dilations.y;
                if (dyC < 0.0 || dyC >= ${g}(uniforms.Dy_shape[${l}]) ||
                    fract(dyC) > 0.0 || wCPerm < 0) {
                  continue;
                }
                let idyC: u32 = u32(dyC);
                var inputChannel = groupId * uniforms.input_channels_per_group;
                for (var d2: u32 = 0; d2 < uniforms.input_channels_per_group; d2 = d2 + ${L}) {
                  let xValue = ${W?W0.getByOffset(`${W0.indicesToOffset(`${W0.type.indices}(batch, idyR, idyC, inputChannel)`)} / ${L}`):W0.get("batch","inputChannel","idyR","idyC")};
                  ${G0()}
                  inputChannel = inputChannel + ${L};
                }
                wC = wC + uniforms.strides.y - 1;
              }
              wR = wR + uniforms.strides[0] - 1;
            }
            let value = dotProd${Y?` + bias[d1 / ${B}]`:""};
            ${o.setByOffset("global_idx","value")};
          `;return`
    ${C.registerUniforms(T).declareVariables(...j0,o)}
      ${C.mainStart()}
      ${C.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")};
    ${F0}}`};return{name:"ConvTranspose2D",shaderCache:{hint:`${Q.cacheKey};${L}${U}${B}${V===1}`,inputDependencies:A},getRunData:()=>({dispatchGroup:{x:R[0],y:R[1],z:R[2]},outputs:[{dims:X?X(H):H,dataType:J[0].dataType}],programUniforms:k}),getShaderSource:I}}}),zD=J0(()=>{AD(),v8(),u6(),jW=(J,Q,X,Y,H,W)=>(J-1)*Q+X+(Y-1)*H+1-W,FW=(J,Q,X,Y,H)=>{let W=Math.floor(J/2);Q==="SAME_UPPER"?(X[Y]=W,X[H]=J-W):Q==="SAME_LOWER"&&(X[Y]=J-W,X[H]=W)},NW=(J,Q,X,Y,H,W,G,j,N,V)=>{let L=J.length-2,B=V.length===0;N.length<L&&N.push(...Array(L-N.length).fill(0));let U=J[0],E=Q[j?3:1]*H;for(let R=0,A=J.length-L-(j?1:0);R<L;++R,++A){let P=J[A],z=B?P*G[R]:V[R],D=jW(P,G[R],W[R],Q[A],X[R],z);FW(D,Y,W,R,R+L),B&&V.push(G[R]*(P-1)+N[R]+(Q[A]-1)*X[R]+1-W[R]-W[R+L])}V.splice(0,0,U),V.splice(j?3:1,0,E)},LX=(J,Q)=>{let X=J.kernelShape.slice();if(J.kernelShape.length===0||J.kernelShape.reduce((B,U)=>B*U,1)===0){X.length=0;for(let B=2;B<Q[1].dims.length;++B)X.push(Q[1].dims[B])}let Y=J.format==="NHWC";X.splice(0,0,Q[1].dims[0]),X.splice(Y?3:1,0,Q[1].dims[1]);let H=J.pads.slice(),W=J.outputShape.slice(),G=J.outputPadding.slice(),j=Q[0].dims,N=J.dilations.slice();if(N.reduce((B,U)=>B+U,0)===0){let B=Q[0].dims.length-2;N=Array(B).fill(1)}let V=J.strides.slice();if(V.reduce((B,U)=>B+U,0)===0){let B=Q[0].dims.length-2;V=Array(B).fill(1)}NW(j,X,N,J.autoPad,J.group,H,V,Y,G,W);let L=Object.assign({},J);return Object.assign(L,{kernelShape:X,pads:H,outputPadding:G,outputShape:W,dilations:N,strides:V}),L},AN=(J)=>{let Q=D3(J),X=J.format,Y=["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][typeof J.autoPad>"u"?0:J.autoPad],H=J.dilations,W=J.group,G=J.kernelShape,j=J.pads,N=J.strides,V=J.wIsConst(),L=J.outputPadding,B=J.outputShape;return{autoPad:Y,format:X,dilations:H,group:W,kernelShape:G,outputPadding:L,outputShape:B,pads:j,strides:N,wIsConst:V,...Q,cacheKey:`${J.format};${Q.activation};`}},VW=(J,Q)=>{if(!J||J.length!==2&&J.length!==3)throw Error("Conv requires 2 or 3 inputs");if(J[0].dims.length!==4&&J[0].dims.length!==3)throw Error("currently only support 2-dimensional conv");if(J[0].dims.length!==J[1].dims.length)throw Error("filter does not have same dimension as input");let X=J[0].dims[Q.format==="NHWC"?J[0].dims.length-1:1],Y=J[1].dims[0];if(X!==Y)throw Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");let H=J[1].dims[1]*Q.group;if(J.length===3&&(J[2].dims.length!==1||J[2].dims[0]!==H))throw Error("invalid bias");let W=J[0].dims.length-2;if(Q.dilations.reduce((G,j)=>G+j,0)>0&&Q.dilations.length!==W)throw Error(`dilations should be ${W}D`);if(Q.strides.reduce((G,j)=>G+j,0)>0&&Q.strides.length!==W)throw Error(`strides should be ${W}D`);if(Q.pads.reduce((G,j)=>G+j,0)>0&&Q.pads.length!==W*2)throw Error(`pads should be ${W*2}D`);if(Q.outputPadding.length!==W&&Q.outputPadding.length!==0)throw Error(`output_padding should be ${W}D`);if(Q.kernelShape.reduce((G,j)=>G+j,0)>0&&Q.kernelShape.length!==0&&Q.kernelShape.length!==J[1].dims.length-2)throw Error("invalid kernel shape");if(Q.outputShape.length!==0&&Q.outputShape.length!==J[0].dims.length-2)throw Error("invalid output shape")},UX=(J,Q,X,Y)=>{let H=J.kernelCustomData.wT??J.compute(x1(Q[1],[2,3,0,1]),{inputs:[1],outputs:[X.wIsConst?-2:-1]})[0];X.wIsConst&&!J.kernelCustomData.wT&&(J.kernelCustomData.wT=H);let W=[Q[0],H];Q.length===3&&W.push(Q[2]),J.compute(DN(W,X,Y),{inputs:W})},KW=(J,Q)=>{let X=Q.format==="NHWC",Y=[J.inputs[0].reshape(X?[J.inputs[0].dims[0],1,J.inputs[0].dims[1],J.inputs[0].dims[2]]:[J.inputs[0].dims[0],J.inputs[0].dims[1],1,J.inputs[0].dims[2]]),J.inputs[1].reshape([J.inputs[1].dims[0],J.inputs[1].dims[1],1,J.inputs[1].dims[2]])];J.inputs.length===3&&Y.push(J.inputs[2]);let H=Q.kernelShape;(H.length===0||H[0]===0)&&(H=[J.inputs[1].dims[2]]);let W=Q.dilations;(W.length===0||W[0]===0)&&(W=[1]);let G=Q.strides;(G.length===0||G[0]===0)&&(G=[1]);let j=Q.pads;j.length===0&&(j=[0,0]),j=[0,j[0],0,j[1]],G=[1].concat(G),W=[1].concat(W),H=[1].concat(H);let N=Q.outputPadding;N=[0].concat(N);let V=LX({...Q,pads:j,strides:G,dilations:W,kernelShape:H,outputPadding:N},Y);UX(J,Y,V,(L)=>X?[L[0],L[2],L[3]]:[L[0],L[1],L[3]])},zN=(J,Q)=>{if(VW(J.inputs,Q),J.inputs[0].dims.length===3)KW(J,Q);else{let X=LX(Q,J.inputs);UX(J,J.inputs,X)}}}),$D=J0(()=>{A0(),Z0(),J1(),C0(),MW=(J,Q,X,Y)=>{let H=d.size(Q),W=Q.length,G=a("input",J,W),j=M0("output",J,W),N=X.dataType===6?X.getInt32Array()[0]:Number(X.getBigInt64Array()[0]),V=d.normalizeAxis(N,W),L=(B)=>{let U=` i32(${G.indicesGet("inputIndices","uniforms.axis")}) `,E=L0("uniforms.input_shape","uniforms.axis",W),R=Y.reverse?U+(Y.exclusive?" + 1":""):"0",A=Y.reverse?E:U+(Y.exclusive?"":" + 1");return`
                ${B.registerUniform("outputSize","u32").registerUniform("axis","u32").declareVariables(G,j)}
                ${B.mainStart()}
                  ${B.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
                  var inputIndices = ${j.offsetToIndices("global_idx")};
                  var sum = ${j.type.value}(0);
                  let first : i32 = ${R};
                  let last : i32 = ${A};
                  for (var i : i32 = first; i < last; i++) {
                    ${G.indicesSet("inputIndices","uniforms.axis","u32(i)")};
                    sum = sum + ${G.getByIndices("inputIndices")};
                  }
                  ${j.setByOffset("global_idx","sum")};
                }`};return{name:"CumSum",shaderCache:{hint:Y.cacheKey,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:Q,dataType:J}],dispatchGroup:{x:Math.ceil(H/64)},programUniforms:[{type:12,data:H},{type:12,data:V},...O0(Q,Q)]}),getShaderSource:L}},$N=(J,Q)=>{let X=J.inputs[0].dims,Y=J.inputs[0].dataType,H=J.inputs[1];J.compute(MW(Y,X,H,Q),{inputs:[0]})},PN=(J)=>{let Q=J.exclusive===1,X=J.reverse===1;return c0({exclusive:Q,reverse:X})}}),PD=J0(()=>{A0(),Z0(),J1(),C0(),BW=(J)=>{if(!J||J.length!==1)throw Error("DepthToSpace requires 1 input.");if(J[0].dims.length!==4)throw Error("DepthToSpace requires 4D input.")},LW=(J,Q,X,Y)=>{let H=[];H.push(`fn perm(i: ${Y.type.indices}) -> ${X.type.indices} {
    var a: ${X.type.indices};`);for(let W=0;W<Q;++W)H.push(X.indicesSet("a",J[W],`i[${W}]`));return H.push("return a;}"),H.join(`
`)},UW=(J,Q)=>{let X,Y,H,W,G,j,N=Q.format==="NHWC",V=Q.blocksize,L=Q.mode==="DCR";N?([X,Y,H,W]=J.dims,G=L?[X,Y,H,V,V,W/V**2]:[X,Y,H,W/V**2,V,V],j=L?[0,1,3,2,4,5]:[0,1,4,2,5,3]):([X,Y,H,W]=[J.dims[0],J.dims[2],J.dims[3],J.dims[1]],G=L?[X,V,V,W/V**2,Y,H]:[X,W/V**2,V,V,Y,H],j=L?[0,3,4,1,5,2]:[0,1,4,2,5,3]);let B=J.reshape(G),U=B.dims.length,E=J.dataType,R=a("a",E,U),A=M0("output",E,U),P=(z)=>`
  ${z.registerUniform("output_size","u32").declareVariables(R,A)}

  ${LW(j,U,R,A)}

  ${z.mainStart()}
    ${z.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${A.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${A.setByOffset("global_idx",R.getByIndices("aIndices"))}
  }`;return{name:"DepthToSpace",shaderCache:{hint:`${J.dims};${Q.blocksize};${Q.mode}`,inputDependencies:["rank"]},getRunData:(z)=>{let D=N?[X,Y*V,H*V,W/V**2]:[X,W/V**2,Y*V,H*V],S=d.size(D),w=B.dims,k=d.sortBasedOnPerm(w,j);return{outputs:[{dims:D,dataType:z[0].dataType}],dispatchGroup:{x:Math.ceil(S/64)},programUniforms:[{type:12,data:S},...O0(w,k)]}},getShaderSource:P}},SN=(J,Q)=>{BW(J.inputs),J.compute(UW(J.inputs[0],Q))},ZN=(J)=>c0({blocksize:J.blocksize,mode:J.mode,format:J.format})}),SD=J0(()=>{A0(),Z0(),J1(),C0(),_5="[a-zA-Z]|\\.\\.\\.",Z2="("+_5+")+",OX="^"+Z2+"$",OW="("+Z2+",)*"+Z2,RW="^"+OW+"$",EW=class{constructor(J=-1){this.symbolToIndices=new Map,this.inputIndex=J}addSymbol(J,Q){let X=this.symbolToIndices.get(J);X===void 0?X=[Q]:X.push(Q),this.symbolToIndices.set(J,X)}},DW=class{constructor(J,Q){this.equation=Q,this.hasEllipsis=!1,this.symbolToInfo=new Map,this.lhs=[],this.outputDims=[];let[X,Y]=Q.includes("->")?Q.split("->",2):[Q,""];if(!X.match(RegExp(RW)))throw Error("Invalid LHS term");if(X.split(",").forEach((H,W)=>{let G=J[W].dims.slice();if(!H.match(RegExp(OX)))throw Error("Invalid LHS term");let j=this.processTerm(H,!0,G,W);this.lhs.push(j)}),Y==="")Y+=[...this.symbolToInfo.entries()].filter(([H,W])=>W.count===1||H==="...").map(([H])=>H).join("");else if(!Y.match(RegExp(Z2)))throw Error("Invalid RHS");Y.match(RegExp(_5,"g"))?.forEach((H)=>{if(H==="...")this.outputDims=this.outputDims.concat(this.ellipsisDims);else{let W=this.symbolToInfo.get(H);if(W===void 0)throw Error("Invalid RHS symbol");this.outputDims.push(W.dimValue)}}),this.rhs=this.processTerm(Y,!1,this.outputDims)}addSymbol(J,Q,X){let Y=this.symbolToInfo.get(J);if(Y!==void 0){if(Y.dimValue!==Q&&Y.count!==1)throw Error("Dimension mismatch");Y.count++,Y.inputIndices.push(X)}else Y={count:1,dimValue:Q,inputIndices:[X]};this.symbolToInfo.set(J,Y)}processTerm(J,Q,X,Y=-1){let H=X.length,W=!1,G=[],j=0;if(!J.match(RegExp(OX))&&!Q&&J!=="")throw Error("Invalid LHS term");let N=J.match(RegExp(_5,"g")),V=new EW(Y);return N?.forEach((L,B)=>{if(L==="..."){if(W)throw Error("Only one ellipsis is allowed per input term");W=!0;let U=H-N.length+1;if(U<0)throw Error("Ellipsis out of bounds");if(G=X.slice(j,j+U),this.hasEllipsis){if(this.ellipsisDims.length!==G.length||this.ellipsisDims.toString()!==G.toString())throw Error("Ellipsis dimensions mismatch")}else if(Q)this.hasEllipsis=!0,this.ellipsisDims=G;else throw Error("Ellipsis must be specified in the LHS");for(let E=0;E<G.length;E++){let R=String.fromCharCode(48+E);V.addSymbol(R,B+E),this.addSymbol(R,X[j++],Y)}}else V.addSymbol(L,B+(this.hasEllipsis?this.ellipsisDims.length-1:0)),this.addSymbol(L,X[j++],Y)}),V}},RX=(J)=>J+"_max",AW=(J,Q,X,Y)=>{let H=J.map((V)=>V.length).map((V,L)=>a(`input${L}`,Q,V)),W=d.size(Y),G=M0("output",Q,Y.length),j=[...X.symbolToInfo.keys()].filter((V)=>!X.rhs.symbolToIndices.has(V)),N=(V)=>{let L=[],B="var prod = 1.0;",U="var sum = 0.0;",E="sum += prod;",R=[],A=[],P=[],z=[],D=X.symbolToInfo.size===X.rhs.symbolToIndices.size;X.symbolToInfo.forEach((w,k)=>{if(X.rhs.symbolToIndices.has(k)){let I=X.rhs.symbolToIndices.get(k)?.[0];I!==void 0&&X.lhs.forEach((C,T)=>{if(w.inputIndices.includes(T)){let g=C.symbolToIndices.get(k);if(g===void 0)throw Error("Invalid symbol error");g.forEach((m)=>{L.push(`${H[T].indicesSet(`input${T}Indices`,m,G.indicesGet("outputIndices",I))}`)})}})}else X.lhs.forEach((I,C)=>{if(w.inputIndices.includes(C)){let T=I.symbolToIndices.get(k);if(T===void 0)throw Error("Invalid symbol error");T.forEach((g)=>{R.push(`${H[C].indicesSet(`input${C}Indices`,g,`${k}`)}`)}),z.push(`prod *= ${H[C].getByIndices(`input${C}Indices`)};`)}}),A.push(`for(var ${k}: u32 = 0; ${k} < uniforms.${RX(k)}; ${k}++) {`),P.push("}")});let S=D?[...L,`let sum = ${H.map((w,k)=>w.getByIndices(`input${k}Indices`)).join(" * ")};`]:[...L,U,...A,...R,B,...z,E,...P];return`
            ${V.registerUniforms(j.map((w)=>({name:`${RX(w)}`,type:"u32"}))).registerUniform("outputSize","u32").declareVariables(...H,G)}

            ${V.mainStart()}
            ${V.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
            var outputIndices = ${G.offsetToIndices("global_idx")};
            ${H.map((w,k)=>`var input${k}Indices: ${H[k].type.indices};`).join(`
`)}
            ${S.join(`
`)};
            ${G.setByOffset("global_idx","sum")};
          }`};return{name:"Einsum",shaderCache:{hint:X.equation,inputDependencies:J.map(()=>"rank")},getRunData:()=>{let V=j.filter((B)=>X.symbolToInfo.has(B)).map((B)=>({type:12,data:X.symbolToInfo.get(B)?.dimValue||0}));V.push({type:12,data:W});let L=J.map((B,U)=>[...O0(B)]).reduce((B,U)=>B.concat(U),V);return L.push(...O0(Y)),{outputs:[{dims:Y,dataType:Q}],dispatchGroup:{x:Math.ceil(W/64)},programUniforms:L}},getShaderSource:N}},wN=(J,Q)=>{let X=new DW(J.inputs,Q.equation),Y=X.outputDims,H=J.inputs.map((W,G)=>W.dims);J.compute(AW(H,J.inputs[0].dataType,X,Y))},kN=(J)=>{let Q=J.equation.replace(/\s+/g,"");return c0({equation:Q})}}),ZD=J0(()=>{A0(),Z0(),C0(),zW=(J)=>{if(!J||J.length!==2)throw Error("Expand requires 2 input.");let Q=J[0].dims,X=Array.from(J[1].getBigInt64Array(),Number),Y=X.length<Q.length?0:X.length-Q.length,H=Q.length<X.length?0:Q.length-X.length;for(;Y<X.length&&H<Q.length;++Y,++H)if(X[Y]!==Q[H]&&X[Y]!==1&&Q[H]!==1)throw Error("Expand requires shape to be broadcastable to input")},EX=(J,Q)=>{let X=J.length-Q.length,Y=[];for(let H=0;H<X;++H)Y.push(J[H]);for(let H=0;H<Q.length;++H)Y.push(Q[H]===1?J[H+X]:Q[H]);return Y},$W=(J,Q)=>J.length>Q.length?EX(J,Q):EX(Q,J),PW=(J)=>{let Q=J[0].dims,X=Array.from(J[1].getBigInt64Array(),Number),Y=$W(Q,X),H=J[0].dataType,W=H===9||d.size(Q)===1,G=H===9||Q.length>0&&Q[Q.length-1]%4===0?4:1,j=W||Y.length>0&&Y[Y.length-1]%4===0?4:1,N=Math.ceil(d.size(Y)/j),V=(B)=>{let U=a("input",H,Q.length,G),E=M0("output",H,Y.length,j),R;if(H===9){let A=(P,z,D="")=>`
          let outputIndices${z} = ${E.offsetToIndices(`outputOffset + ${z}u`)};
          let offset${z} = ${U.broadcastedIndicesToOffset(`outputIndices${z}`,E)};
          let index${z} = offset${z} / 4u;
          let component${z} = offset${z} % 4u;
          ${P}[${z}] = ${D}(${U.getByOffset(`index${z}`)}[component${z}]);
        `;R=`
        let outputOffset = global_idx * ${j};
        var data = vec4<u32>(0);
        ${A("data",0,"u32")}
        ${A("data",1,"u32")}
        ${A("data",2,"u32")}
        ${A("data",3,"u32")}
        ${E.setByOffset("global_idx","data")}
      }`}else R=`
        let outputIndices = ${E.offsetToIndices(`global_idx * ${j}`)};
        let inputOffset = ${U.broadcastedIndicesToOffset("outputIndices",E)};
        let data = ${E.type.value}(${U.getByOffset(`inputOffset / ${G}`)});
        ${E.setByOffset("global_idx","data")}
      }`;return`
    ${B.registerUniform("vec_size","u32").declareVariables(U,E)}
    ${B.mainStart()}
    ${B.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
    ${R}`},L=[{type:12,data:N},...O0(Q,Y)];return{name:"Expand",shaderCache:{hint:`${Y.length};${G}${j}`,inputDependencies:["rank"]},getShaderSource:V,getRunData:()=>({outputs:[{dims:Y,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(N/64)},programUniforms:L})}},CN=(J)=>{zW(J.inputs),J.compute(PW(J.inputs),{inputs:[0]})}}),wD=J0(()=>{A0(),Z0(),C0(),E3(),SW=(J)=>{let Q=J[0].dataType,X=d.size(J[0].dims),Y=d.size(J[1].dims),H=Y%4===0,W=(G)=>{let j=a("x",Q,[1],4),N=a("bias",Q,[1],4),V=M0("y",Q,[1],4),L=[{name:"output_vec_size",type:"u32"},{name:"bias_size",type:"u32"}],B=(E)=>`
      let bias${E}_offset: u32 = (global_idx * 4 + ${E}) % uniforms.bias_size;
      let bias${E} = ${N.getByOffset(`bias${E}_offset / 4`)}[bias${E}_offset % 4];`,U=H?`
      let bias = ${N.getByOffset("global_idx % (uniforms.bias_size / 4)")};`:`${B(0)}${B(1)}${B(2)}${B(3)}
      let bias = ${j.type.value}(bias0, bias1, bias2, bias3);`;return`${G.registerUniforms(L).declareVariables(j,N,V)}

    ${sX($1(Q))}

    ${G.mainStart(Q7)}
      ${G.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_vec_size")}

      let x = ${j.getByOffset("global_idx")};
      ${U}
      let x_in = x + bias;
      ${V.setByOffset("global_idx",aX("x_in"))}
    }`};return{name:"FastGeluWithBias",shaderCache:{hint:`${H}`,inputDependencies:["type","type"]},getShaderSource:W,getRunData:(G)=>({outputs:[{dims:G[0].dims,dataType:G[0].dataType}],programUniforms:[{type:12,data:Math.ceil(X/4)},{type:12,data:Y}],dispatchGroup:{x:Math.ceil(X/Q7/4)}})}},IN=(J)=>{J.inputs.length<2||d.size(J.inputs[1].dims)===0?nF(J):J.compute(SW(J.inputs))}}),kD=J0(()=>{A0(),Z0(),J1(),C0(),ZW=(J)=>{if(!J||J.length!==2)throw Error("Gather requires 2 inputs.")},wW=(J,Q)=>{let X=J[0].dims,Y=J[1].dims,H=X.length,W=d.normalizeAxis(Q.axis,H),G=X.slice(0);G.splice(W,1,...Y);let j=X[W],N=J[0].dataType===9?4:1,V=Math.ceil(d.size(G)/N),L=[{type:12,data:V},{type:6,data:j},{type:12,data:W},...O0(J[0].dims,J[1].dims,G)],B=(U)=>{let E=a("data",J[0].dataType,J[0].dims.length,N),R=a("inputIndices",J[1].dataType,J[1].dims.length),A=M0("output",J[0].dataType,G.length,N),P=(D)=>{let S=Y.length,w=`var indicesIndices${D}  = ${R.type.indices}(0);`;for(let k=0;k<S;k++)w+=`${S>1?`indicesIndices${D}[${k}]`:`indicesIndices${D}`} = ${G.length>1?`outputIndices${D}[uniforms.axis + ${k}]`:`outputIndices${D}`};`;w+=`
          var idx${D} = ${R.getByIndices(`indicesIndices${D}`)};
          if (idx${D} < 0) {
            idx${D} = idx${D} + uniforms.axisDimLimit;
          }
          var dataIndices${D} : ${E.type.indices};
        `;for(let k=0,I=0;k<H;k++)k===W?(w+=`${H>1?`dataIndices${D}[${k}]`:`dataIndices${D}`} = u32(idx${D});`,I+=S):(w+=`${H>1?`dataIndices${D}[${k}]`:`dataIndices${D}`} = ${G.length>1?`outputIndices${D}[${I}]`:`outputIndices${D}`};`,I++);return w},z;if(J[0].dataType===9){let D=(S,w,k="")=>`
          let outputIndices${w} = ${A.offsetToIndices(`outputOffset + ${w}u`)};
          ${P(w)};
          let offset${w} = ${E.indicesToOffset(`dataIndices${w}`)};
          let index${w} = offset${w} / 4u;
          let component${w} = offset${w} % 4u;
          ${S}[${w}] = ${k}(${E.getByOffset(`index${w}`)}[component${w}]);
        `;z=`
        let outputOffset = global_idx * ${N};
        var value = vec4<u32>(0);
        ${D("value",0,"u32")}
        ${D("value",1,"u32")}
        ${D("value",2,"u32")}
        ${D("value",3,"u32")}
        ${A.setByOffset("global_idx","value")}
      `}else z=`
      let outputIndices = ${A.offsetToIndices("global_idx")};
      ${P("")};
      let value = ${E.getByIndices("dataIndices")};
      ${A.setByOffset("global_idx","value")};
      `;return`
      ${U.registerUniform("outputSize","u32").registerUniform("axisDimLimit","i32").registerUniform("axis","u32").declareVariables(E,R,A)}
      ${U.mainStart()}
        ${U.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        ${z}
      }`};return{name:"Gather",shaderCache:{hint:Q.cacheKey,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:G,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(V/64)},programUniforms:L}),getShaderSource:B}},_N=(J)=>c0({axis:J.axis}),bN=(J,Q)=>{let X=J.inputs;ZW(X),J.compute(wW(J.inputs,Q))}}),CD=J0(()=>{A0(),Z0(),C0(),kW=(J,Q,X,Y,H,W,G,j,N)=>{let V=[{type:12,data:W},{type:12,data:Y},{type:12,data:H},{type:12,data:X},{type:12,data:G},{type:12,data:j},{type:12,data:N}],L=[W];V.push(...O0(Q.dims,L));let B=(U)=>{let E=a("indices_data",Q.dataType,Q.dims.length),R=M0("input_slice_offsets_data",12,1,1),A=[E,R],P=[{name:"output_size",type:"u32"},{name:"batch_dims",type:"u32"},{name:"input_dims",type:"u32",length:H.length},{name:"sizes_from_slice_dims_data",type:"u32",length:X.length},{name:"num_slices_per_batch",type:"u32"},{name:"input_batch_stride",type:"u32"},{name:"num_slice_dims",type:"u32"}];return`
  ${U.registerUniforms(P).declareVariables(...A)}
  ${U.mainStart()}
    ${U.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let batch_idx = global_idx / uniforms.num_slices_per_batch;
    let base_offset = batch_idx * uniforms.input_batch_stride;

    let slice_indices_base_offset = global_idx * uniforms.num_slice_dims;
    var relative_slice_offset = 0;
    for (var dim_idx = 0u; dim_idx < uniforms.num_slice_dims; dim_idx ++) {
      var index = i32(indices_data[dim_idx + slice_indices_base_offset].x);
      let input_dim_idx = uniforms.batch_dims + dim_idx;
      if (index < 0) {
        ${H.length===1?"index += i32(uniforms.input_dims);":"index += i32(uniforms.input_dims[input_dim_idx]);"}
      }
      ${X.length===1?"relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data);":"relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data[dim_idx]);"}
    }

    input_slice_offsets_data[global_idx] =  base_offset + u32(relative_slice_offset);
  }`};return J.compute({name:"computeSliceOffsets",shaderCache:{hint:`${H.length}_${X.length}`,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:L,dataType:J.inputs[1].dataType}],dispatchGroup:{x:Math.ceil(W/64)},programUniforms:V}),getShaderSource:B},{inputs:[Q],outputs:[-1]})[0]},vN=(J,Q)=>{let X=J.inputs,Y=X[0].dims,H=X[0].dataType,W=X[1].dims,G=W[W.length-1],j=d.sizeToDimension(W,W.length-1),N=d.sizeFromDimension(Y,Q.batchDims+G),V=d.sizeToDimension(Y,Q.batchDims),L=d.sizeFromDimension(Y,Q.batchDims),B=j/V,U=Array(G),E=N;for(let w=0;w<G;++w)U[G-1-w]=E,E*=Y[Q.batchDims+G-1-w];let R=kW(J,X[1],U,Q.batchDims,Y,j,B,L,G),A=Q.batchDims+G;if(A>Y.length)throw Error("last dimension of indices must not be larger than rank of input tensor");let P=W.slice(0,-1).concat(Y.slice(A)),z=d.size(P),D=[{type:12,data:z},{type:12,data:N},...O0(X[0].dims,R.dims,P)],S=(w)=>{let k=a("data",X[0].dataType,X[0].dims.length),I=a("slice_offsets",12,R.dims.length),C=M0("output",X[0].dataType,P.length);return`
          ${w.registerUniform("output_size","u32").registerUniform("slice_size","u32").declareVariables(k,I,C)}
            ${w.mainStart()}
            ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let slice_offset = slice_offsets[global_idx / uniforms.slice_size];
          output[global_idx] = data[u32(slice_offset) + global_idx % uniforms.slice_size];
        }`};J.compute({name:"GatherND",shaderCache:{hint:Q.cacheKey,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:P,dataType:H}],dispatchGroup:{x:Math.ceil(z/64)},programUniforms:D}),getShaderSource:S},{inputs:[X[0],R]})},TN=(J)=>({batchDims:J.batch_dims,cacheKey:""})}),ID=J0(()=>{A0(),Z0(),J1(),C0(),CW=(J,Q)=>{if(J.length<3||J.length>4)throw Error("GatherBlockQuantized requires 3 or 4 inputs.");let X=d.normalizeAxis(Q.quantizeAxis,J[0].dims.length),Y=Q.blockSize,H=J[0],W=J[2],G=J.length===4?J[3]:void 0;if(W.dims.length!==H.dims.length||!H.dims.map((j,N)=>N===X?Math.ceil(j/Y)===W.dims[N]:j===W.dims[N]).reduce((j,N)=>j&&N,!0))throw Error("Scales must have the same rank as the input tensor and the dims should match except on gatherAxis.");if(G){if(G.dataType!==H.dataType)throw Error("Zero point must have the same data type as the input tensor.");if(G.dims.length!==W.dims.length||!G.dims.map((j,N)=>j===W.dims[N]).reduce((j,N)=>j&&N,!0))throw Error("Zero point must have the same rank as the input tensor and the dims should match except on quantizeAxis.")}},IW=(J,Q)=>{let X=J[0].dims,Y=J[1].dims,H=X.length,W=d.normalizeAxis(Q.gatherAxis,H),G=d.normalizeAxis(Q.quantizeAxis,H),j=X.slice(0);j.splice(W,1,...Y);let N=d.size(j),V=J[2].dataType,L=J[0].dataType===22,B=[{type:12,data:N},{type:12,data:G},{type:12,data:W},{type:12,data:Q.blockSize},...O0(...J.map((E,R)=>E.dims),j)],U=(E)=>{let R=a("data",J[0].dataType,J[0].dims.length),A=a("inputIndices",J[1].dataType,J[1].dims.length),P=a("scales",J[2].dataType,J[2].dims.length),z=J.length>3?a("zeroPoint",J[3].dataType,J[3].dims.length):void 0,D=M0("output",V,j.length),S=[R,A,P];z&&S.push(z);let w=[{name:"output_size",type:"u32"},{name:"quantize_axis",type:"u32"},{name:"gather_axis",type:"u32"},{name:"block_size",type:"u32"}];return`
        ${E.registerUniforms(w).declareVariables(...S,D)}
        ${E.mainStart()}
        let output_indices = ${D.offsetToIndices("global_idx")};
        var indices_indices = ${A.type.indices}(0);
        ${Y.length>1?`
          for (var i: u32 = 0; i < ${Y.length}; i++) {
            let index = ${D.indicesGet("output_indices","uniforms.gather_axis + i")};
            ${A.indicesSet("indices_indices","i","index")};
          }`:`indices_indices = ${D.indicesGet("output_indices","uniforms.gather_axis")};`};
        var data_indices = ${R.type.indices}(0);
        for (var i: u32 = 0; i < uniforms.gather_axis; i++) {
          let index = ${D.indicesGet("output_indices","i")};
          ${R.indicesSet("data_indices","i","index")};
        }
        var index_from_indices = ${A.getByIndices("indices_indices")};
        if (index_from_indices < 0) {
          index_from_indices += ${X[W]};
        }
        ${R.indicesSet("data_indices","uniforms.gather_axis","u32(index_from_indices)")};
        for (var i = uniforms.gather_axis + 1; i < ${j.length}; i++) {
          let index = ${D.indicesGet("output_indices",`i + ${Y.length} - 1`)};
          ${R.indicesSet("data_indices","i","index")};
        }
        let data_offset = ${R.indicesToOffset("data_indices")};
        let data_index = data_offset % 8;
        // Convert 4-bit packed data to 8-bit packed data.
        let packed_4bit_quantized_data = ${R.getByOffset("data_offset / 8")};
        let packed_8bit_quantized_data = (packed_4bit_quantized_data >> (4 * (data_index % 2))) & 0x0f0f0f0f;
        let quantized_data_vec = ${L?"unpack4xI8":"unpack4xU8"}(u32(packed_8bit_quantized_data));
        let quantized_data = quantized_data_vec[data_index / 2];
        var scale_indices = data_indices;
        let quantize_axis_index = ${P.indicesGet("data_indices","uniforms.quantize_axis")} / uniforms.block_size;
        ${P.indicesSet("scale_indices","uniforms.quantize_axis","quantize_axis_index")};
        var scale = ${P.getByIndices("scale_indices")};
        ${z?`
              let zero_point_indices = scale_indices;
              let zero_point_offset = ${z.indicesToOffset("zero_point_indices")};
              let zero_point_index = zero_point_offset % 8;
              let packed_4bit_zero_points = ${z.getByOffset("zero_point_offset / 8")};
              let packed_8bit_zero_points = (packed_4bit_zero_points >> (4 * (zero_point_index % 2))) & 0x0f0f0f0f;
              let zero_point_vec = ${L?"unpack4xI8":"unpack4xU8"}(u32(packed_8bit_zero_points));
              let zero_point = zero_point_vec[zero_point_index / 2];`:"var zero_point = 0"};
        let dequantized_data = ${$1(V)}(quantized_data - zero_point) * scale;
        ${D.setByOffset("global_idx","dequantized_data")};
    }`};return{name:"GatherBlockQuantized",shaderCache:{hint:`${Q.cacheKey};${J.filter((E,R)=>R!==1).map((E)=>E.dims.join("_")).join(";")}`,inputDependencies:Array.from({length:J.length},(E,R)=>"rank")},getRunData:()=>({outputs:[{dims:j,dataType:V}],dispatchGroup:{x:Math.ceil(N/64)},programUniforms:B}),getShaderSource:U}},xN=(J,Q)=>{let X=J.inputs;CW(X,Q),J.compute(IW(J.inputs,Q))},fN=(J)=>c0({blockSize:J.blockSize,gatherAxis:J.gatherAxis,quantizeAxis:J.quantizeAxis})}),_D=J0(()=>{A0(),Z0(),J1(),C0(),_W=(J)=>{if(!J||J.length!==2)throw Error("GatherElements requires 2 inputs.");if(J[0].dims.length<1)throw Error("GatherElements requires that the data input be rank >= 1.");if(J[0].dims.length!==J[1].dims.length)throw Error(`GatherElements requires that the data input and
                     indices input tensors be of same rank.`)},bW=(J,Q)=>{let X=J[0].dims,Y=J[0].dataType,H=X.length,W=J[1].dims,G=J[1].dataType,j=d.normalizeAxis(Q.axis,H),N=X[j],V=W.slice(0),L=d.size(V),B=a("input",Y,H),U=a("indicesInput",G,W.length),E=M0("output",Y,V.length),R=[{type:12,data:L},{type:6,data:N},{type:12,data:j}];return R.push(...O0(X,W,V)),{name:"GatherElements",shaderCache:{inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:V,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(L/64)},programUniforms:R}),getShaderSource:(A)=>`
      ${A.registerUniform("outputSize","u32").registerUniform("axisDimLimit","i32").registerUniform("axis","u32").declareVariables(B,U,E)}
      ${A.mainStart()}
      ${A.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

      let outputIndices = ${E.offsetToIndices("global_idx")};

      var idx = ${U.getByOffset("global_idx")};
      if (idx < 0) {
        idx = idx + uniforms.axisDimLimit;
      }
      var inputIndices = ${B.type.indices}(outputIndices);
      ${B.indicesSet("inputIndices","uniforms.axis","u32(idx)")};
      let value = ${B.getByIndices("inputIndices")};

      ${E.setByOffset("global_idx","value")};
  }`}},hN=(J)=>c0({axis:J.axis}),yN=(J,Q)=>{let X=J.inputs;_W(X),J.compute(bW(J.inputs,Q))}}),bD=J0(()=>{A0(),Z0(),C0(),vW=(J)=>{if(!J)throw Error("Input is missing");if(J.length<2||J.length>3)throw Error("Invaid input number.");if(J.length===3&&J[2].dims.length>2)throw Error("Invalid input shape of C");if(J[0].dataType!==J[1].dataType||J.length===3&&J[0].dataType!==J[2].dataType)throw Error("Input types are mismatched")},TW=(J,Q)=>{let X=J[0].dims.slice(),Y=J[1].dims.slice(),[H,W,G]=mj.getShapeOfGemmResult(X,Q.transA,Y,Q.transB,J.length===3?J[2].dims:void 0),j=[H,W];if(!j)throw Error("Can't use gemm on the given tensors");let N=16,V=Math.ceil(W/N),L=Math.ceil(H/N),B=!0,U=d.size(j),E=[{type:12,data:B?V:U},{type:12,data:H},{type:12,data:W},{type:12,data:G},{type:1,data:Q.alpha},{type:1,data:Q.beta}],R=["type","type"];J.length===3&&(E.push(...O0(J[2].dims)),R.push("rank")),E.push(...O0(j));let A=(z)=>{let D="";Q.transA&&Q.transB?D="value += a[k * uniforms.M + m] * b[n * uniforms.K + k];":Q.transA&&!Q.transB?D="value += a[k * uniforms.M + m] * b[k * uniforms.N + n];":!Q.transA&&Q.transB?D="value += a[m * uniforms.K + k] * b[n * uniforms.K + k];":!Q.transA&&!Q.transB&&(D="value += a[m * uniforms.K + k] * b[k * uniforms.N + n];");let S=Q.alpha===1?"":"value *= uniforms.alpha;",w=a("a",J[0].dataType,J[0].dims),k=a("b",J[1].dataType,J[1].dims),I=w.type.value,C=null,T=[w,k];J.length===3&&(C=a("c",J[2].dataType,J[2].dims.length),T.push(C));let g=M0("output",J[0].dataType,j.length);T.push(g);let m=[{name:"output_size",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"},{name:"alpha",type:"f32"},{name:"beta",type:"f32"}];return`
  ${z.registerUniforms(m).declareVariables(...T)}

  ${z.mainStart()}
    ${z.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let m = global_idx / uniforms.N;
    let n = global_idx % uniforms.N;

    var value = ${I}(0);
    for (var k: u32 = 0u; k < uniforms.K; k++) {
      ${D}
    }

    ${S}
    ${C!=null?`let cOffset = ${C.broadcastedIndicesToOffset("vec2(m, n)",g)}; value += ${I}(uniforms.beta) * ${C.getByOffset("cOffset")};`:""}
    output[global_idx] = value;
  }`},P=(z)=>{let D=a("a",J[0].dataType,J[0].dims),S=a("b",J[1].dataType,J[1].dims),w=null,k=[D,S];J.length===3&&(w=a("c",J[2].dataType,J[2].dims.length),k.push(w));let I=M0("output",J[0].dataType,j.length);k.push(I);let C=[{name:"num_tile_n",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"},{name:"alpha",type:"f32"},{name:"beta",type:"f32"}],T="",g="";Q.transA&&Q.transB?(g=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${D.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${S.type.value}(0);
      }
      `,T="value += tile_a[k][local_id.y] * tile_b[local_id.x][k];"):Q.transA&&!Q.transB?(g=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${D.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${S.type.value}(0);
      }
      `,T="value += tile_a[k][local_id.y] * tile_b[k][local_id.x];"):!Q.transA&&Q.transB?(g=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${D.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${S.type.value}(0);
      }
      `,T="value += tile_a[local_id.y][k] * tile_b[local_id.x][k];"):!Q.transA&&!Q.transB&&(g=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${D.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${S.type.value}(0);
      }
      `,T="value += tile_a[local_id.y][k] * tile_b[k][local_id.x];");let m=Q.alpha===1?"":"value *= uniforms.alpha;";return`
  ${z.registerUniforms(C).declareVariables(...k)}
  var<workgroup> tile_a: array<array<${D.type.storage}, ${N}>, ${N}>;
  var<workgroup> tile_b: array<array<${S.type.storage}, ${N}>, ${N}>;
  ${z.mainStart([N,N,1])}
    let tile_col_start = (workgroup_index % uniforms.num_tile_n) * ${N};
    let tile_row_start = (workgroup_index / uniforms.num_tile_n) * ${N};
    let num_tiles = (uniforms.K - 1) / ${N} + 1;
    var k_start = 0u;
    var value = ${I.type.value}(0);
    for (var t: u32 = 0u; t < num_tiles; t++) {
      ${g}
      k_start = k_start + ${N};
      workgroupBarrier();

      for (var k: u32 = 0u; k < ${N}; k++) {
        ${T}
      }
      workgroupBarrier();
    }

    ${m}
    let m = tile_row_start + local_id.y;
    let n = tile_col_start + local_id.x;
    ${w!=null?`let cOffset = ${w.broadcastedIndicesToOffset("vec2(m, n)",I)}; value += ${I.type.value}(uniforms.beta) * ${w.getByOffset("cOffset")};`:""}
    if (m < uniforms.M && n < uniforms.N) {
      output[m * uniforms.N + n] = value;
    }
  }`};return B?{name:"GemmShared",shaderCache:{hint:`${Q.cacheKey}`,inputDependencies:R},getRunData:()=>({outputs:[{dims:j,dataType:J[0].dataType}],dispatchGroup:{x:V*L},programUniforms:E}),getShaderSource:P}:{name:"Gemm",shaderCache:{hint:`${Q.cacheKey}`,inputDependencies:R},getRunData:()=>({outputs:[{dims:j,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(U/64)},programUniforms:E}),getShaderSource:A}},gN=(J)=>{let{transA:Q,transB:X,alpha:Y,beta:H}=J;return{transA:Q,transB:X,alpha:Y,beta:H,cacheKey:`${J.transA};${J.transB};${J.alpha===1}`}},lN=(J,Q)=>{vW(J.inputs),J.compute(TW(J.inputs,Q))}}),vD=J0(()=>{A0(),Z0(),J1(),C0(),[U6,T6,A8,z8]=[0,1,2,3],xW=(J)=>{if(J[0].dims.length!==4)throw Error("only 4-D tensor is supported.");if(J[0].dims.length!==J[1].dims.length)throw Error("input dimensions must be equal to grid dimensions");if(J[0].dims.length-2!==J[1].dims[J[1].dims.length-1])throw Error(`last dimension of grid must be equal to ${J[0].dims.length-2}`);if(J[0].dims[0]!==J[1].dims[0])throw Error("grid batch size must match input batch size")},fW=`
  fn gs_get_cubic_coeffs(x: f32) -> vec4<f32> {
    let cubic_alpha = -0.75f;
    let x_abs = abs(x);
    var coeffs: vec4<f32>;
    coeffs[0] = (((cubic_alpha * (x_abs + 1) - 5 * cubic_alpha) * (x_abs + 1) + 8 * cubic_alpha) * (x_abs + 1) - 4 * cubic_alpha);
    coeffs[1] = (((cubic_alpha + 2) * x_abs - (cubic_alpha + 3)) * x_abs * x_abs + 1);
    coeffs[2] = (((cubic_alpha + 2) * (1 - x_abs) - (cubic_alpha + 3)) * (1 - x_abs) * (1 - x_abs) + 1);
    coeffs[3] = (((cubic_alpha * (2 - x_abs) - 5 * cubic_alpha) * (2 - x_abs) + 8 * cubic_alpha) * (2 - x_abs) - 4 * cubic_alpha);
    return coeffs;
  }
`,hW=(J)=>`
  fn gs_bicubic_interpolate(p: mat4x4<${J}>, x: f32, y: f32) -> ${J} {
    var v: vec4<f32>;
    var coeffs = gs_get_cubic_coeffs(x);
    for (var i = 0; i < 4; i++) {
      v[i] = coeffs[0] * p[i][0] + coeffs[1] * p[i][1] + coeffs[2] * p[i][2] + coeffs[3] * p[i][3];
    }
    coeffs = gs_get_cubic_coeffs(y);
    let pixel = ${J}(coeffs[0] * v[0] + coeffs[1] * v[1] + coeffs[2] * v[2] + coeffs[3] * v[3]);
    return pixel;
  }
`,yW=(J)=>`
  fn gs_denormalize(n: f32, length: i32) -> f32 {
    ${J.alignCorners===0?`
    // alignCorners: false => [-1, 1] to [-0.5, length - 0.5]
    return ((n + 1.0) * f32(length) - 1.0) / 2.0;
    `:`
    // alignCorners: true => [-1, 1] to [0, length - 1]
    return (n + 1.0) / 2.0 * (f32(length - 1));
    `}
  }
`,gW=(J)=>`
  ${J.paddingMode==="reflection"?`
      fn gs_reflect(x: i32, x_min: f32, x_max: f32) -> u32 {
        var dx = 0.0;
        var fx = f32(x);
        let range = x_max - x_min;
        if (fx < x_min) {
          dx = x_min - fx;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_min + r;
          } else {
            fx = x_max - r;
          }
        } else if (fx > x_max) {
          dx = fx - x_max;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_max - r;
          } else {
            fx = x_min + r;
          }
        }
        return u32(fx);
      }`:""}
`,lW=(J,Q,X)=>`
  fn pixel_at_grid(r: i32, c: i32, H: i32, W: i32, batch: u32, channel: u32, border: vec4<f32>) -> ${Q} {
     var pixel = ${Q}(0);
     var indices = vec4<u32>(0);
     indices[${U6}] = batch;
     indices[${T6}] = channel;`+(()=>{switch(X.paddingMode){case"zeros":return`
          if (r >= 0 && r < H && c >=0 && c < W) {
            indices[${A8}] = u32(r);
            indices[${z8}] = u32(c);
          }
        `;case"border":return`
          indices[${A8}] = u32(clamp(r, 0, H - 1));
          indices[${z8}] = u32(clamp(c, 0, W - 1));
        `;case"reflection":return`
          indices[${A8}] = gs_reflect(r, border[1], border[3]);
          indices[${z8}] = gs_reflect(c, border[0], border[2]);
        `;default:throw Error(`padding mode ${X.paddingMode} is not supported`)}})()+`
    return ${J.getByIndices("indices")};
  }
`,mW=(J,Q,X)=>(()=>{switch(X.mode){case"nearest":return`
          let result = pixel_at_grid(i32(round(y)), i32(round(x)), H_in, W_in, indices[${U6}], indices[${T6}], border);
        `;case"bilinear":return`
          let x1 = i32(floor(x));
          let y1 = i32(floor(y));
          let x2 = x1 + 1;
          let y2 = y1 + 1;

          let p11 = pixel_at_grid(y1, x1, H_in, W_in, indices[${U6}], indices[${T6}], border);
          let p12 = pixel_at_grid(y1, x2, H_in, W_in, indices[${U6}], indices[${T6}], border);
          let p21 = pixel_at_grid(y2, x1, H_in, W_in, indices[${U6}], indices[${T6}], border);
          let p22 = pixel_at_grid(y2, x2, H_in, W_in, indices[${U6}], indices[${T6}], border);

          let dx2 = ${Q}(f32(x2) - x);
          let dx1 = ${Q}(x - f32(x1));
          let dy2 = ${Q}(f32(y2) - y);
          let dy1 = ${Q}(y - f32(y1));
          let result = dy2 * (dx2 * p11 + dx1 * p12) + dy1 * (dx2 * p21 + dx1 * p22);
        `;case"bicubic":return`
          let x0 = i32(floor(x)) - 1;
          let y0 = i32(floor(y)) - 1;
          var p: mat4x4<${Q}>;
          for (var h = 0; h < 4; h++) {
            for (var w = 0; w < 4; w++) {
              p[h][w] = pixel_at_grid(h + y0, w + x0, H_in, W_in, indices[${U6}], indices[${T6}], border);
            }
          }

          let dx = x - f32(x0 + 1);
          let dy = y - f32(y0 + 1);
          let result = gs_bicubic_interpolate(p, dx, dy);
        `;default:throw Error(`mode ${X.mode} is not supported`)}})()+`${J.setByOffset("global_idx","result")}`,pW=(J,Q)=>{let X=a("x",J[0].dataType,J[0].dims.length),Y=[J[1].dims[0],J[1].dims[1],J[1].dims[2]],H=a("grid",J[1].dataType,Y.length,2),W=[J[0].dims[0],J[0].dims[1],J[1].dims[1],J[1].dims[2]];Q.format==="NHWC"&&(W=[J[0].dims[0],J[1].dims[1],J[1].dims[2],J[0].dims[3]],[U6,T6,A8,z8]=[0,3,1,2]);let G=M0("output",J[0].dataType,W.length),j=X.type.value,N=d.size(W),V=[{type:12,data:N},...O0(J[0].dims,Y,W)],L=(B)=>`
  ${B.registerUniform("output_size","u32").declareVariables(X,H,G)}
  ${fW}
  ${hW(j)}
  ${yW(Q)}
  ${gW(Q)}
  ${lW(X,j,Q)}

  ${B.mainStart()}
    ${B.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let H_in = i32(uniforms.x_shape[${A8}]);
      let W_in = i32(uniforms.x_shape[${z8}]);

      ${Q.alignCorners===0?`
      let x_min = -0.5;
      let x_max = f32(W_in) - 0.5;
      let y_min = -0.5;
      let y_max = f32(H_in) - 0.5;
      `:`
      let x_min = 0.0;
      let x_max = f32(W_in) - 1.0;
      let y_min = 0.0;
      let y_max = f32(H_in) - 1.0;
      `};
      let border = vec4<f32>(x_min, y_min, x_max, y_max);

      let indices = ${G.offsetToIndices("global_idx")};
      var grid_indices = vec3<u32>(indices[${U6}], indices[${A8}], indices[${z8}]);
      let nxy = ${H.getByIndices("grid_indices")};
      var x = gs_denormalize(f32(nxy[0]), W_in);
      var y = gs_denormalize(f32(nxy[1]), H_in);

      ${mW(G,j,Q)}
  }`;return{name:"GridSample",shaderCache:{hint:`${Q.cacheKey}`,inputDependencies:["type","type"]},getRunData:(B)=>{let U=d.size(W);return{outputs:[{dims:W,dataType:B[0].dataType}],dispatchGroup:{x:Math.ceil(U/64)},programUniforms:V}},getShaderSource:L}},mN=(J,Q)=>{xW(J.inputs),J.compute(pW(J.inputs,Q))},pN=(J)=>c0({alignCorners:J.align_corners,mode:J.mode,paddingMode:J.padding_mode,format:J.format})}),uN=J0(()=>{A0(),Z0(),J1(),L3(),R3(),C0(),u6(),Z1=(J,Q)=>J.length>Q&&J[Q].dims.length>0?J[Q]:void 0,cW=(J,Q)=>{let X=J[0],Y=Z1(J,1),H=Z1(J,2),W=Z1(J,3),G=Z1(J,4),j=Z1(J,5),N=Z1(J,6),V=Z1(J,7);if(X.dims.length!==3&&X.dims.length!==5)throw Error("Input query is expected to have 3 or 5 dimensions");let L=X.dims[0],B=X.dims[1],U=X.dims.length===3?X.dims[2]:Q.numHeads*X.dims[4],E=B,R=0,A=0,P=Math.floor(U/Q.numHeads);if(N&&V&&d.size(N.dims)&&d.size(V.dims)){if(N.dims.length!==4)throw Error('Input "past_key" is expected to have 4 dimensions');if(N.dims[0]!==L||N.dims[1]!==Q.numHeads||N.dims[3]!==P)throw Error('Input "past_key" shape (batch_size, num_heads, past_sequence_length, head_size)');if(V.dims[0]!==L||V.dims[1]!==Q.numHeads||V.dims[3]!==P)throw Error('Input "past_value" shape (batch_size, num_heads, past_sequence_length, head_size)');if(N.dims[2]!==V.dims[2])throw Error('Input "past_key" and "past_value" shall have same dim 2 (past_sequence_length)');if(V.dims.length!==4)throw Error('Input "past_value" is expected to have 4 dimensions');R=N.dims[2],A=N.dims[2]}else if(N&&d.size(N.dims)||V&&d.size(V.dims))throw Error('Input "past_key" and "past_value" shall be both present or both absent');let z;if(Y&&d.size(Y.dims)>0){if(X.dims.length!==3)throw Error('Input "query" is expected to have 3 dimensions when key is given');if(Y.dims.length<3||Y.dims.length>5)throw Error('Input "key" is expected to have 3, 4, or 5 dimensions');if(X.dims[0]!==Y.dims[0])throw Error('Input "query" and "key" shall have same dim 0 (batch size)');if(Y.dims.length===3){if(Y.dims[2]!==X.dims[2])throw Error('Input "query" and "key" shall have same dim 2 (hidden_size)');z=2,E=Y.dims[1]}else if(Y.dims.length===5){if(Y.dims[2]!==Q.numHeads||Y.dims[3]!==2||Y.dims[4]!==P)throw Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');if(H)throw Error('Expect "value" be none when "key" has packed kv format.');z=5,E=Y.dims[1]}else{if(Y.dims[1]!==Q.numHeads||Y.dims[3]!==P)throw Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');z=0,E=Y.dims[2]}}else{if(X.dims.length!==5)throw Error('Input "query" is expected to have 5 dimensions when key is empty');if(X.dims[2]!==Q.numHeads||X.dims[3]!==3)throw Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');z=3}if(W&&d.size(W.dims)>0){if(W.dims.length!==1)throw Error('Input "bias" is expected to have 1 dimension');if(Y&&Y.dims.length===5&&Y.dims[3]===2)throw Error("bias is not allowed for packed kv.")}let D=R+E,S=0;if(G&&d.size(G.dims)>0){S=8;let C=G.dims;throw C.length===1?C[0]===L?S=1:C[0]===3*L+2&&(S=3):C.length===2&&C[0]===L&&C[1]===D&&(S=5),S===8?Error('Input "key_padding_mask" shape shall be (batch_size) or (batch_size, total_sequence_length)'):Error("Mask not supported")}let w=!1,k=U;if(H&&d.size(H.dims)>0){if(H.dims.length!==3&&H.dims.length!==4)throw Error('Input "value" is expected to have 3 or 4 dimensions');if(X.dims[0]!==H.dims[0])throw Error('Input "query" and "value" shall have same dim 0 (batch_size)');if(H.dims.length===3){if(E!==H.dims[1])throw Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');k=H.dims[2]}else{if(E!==H.dims[2])throw Error('Input "key" and "value" shall have the same dim 2 (kv_sequence_length)');k=H.dims[1]*H.dims[3],w=!0}}let I=!1;if(G&&d.size(G.dims)>0)throw Error("Key padding mask is not supported");if(j&&d.size(j.dims)>0){if(j.dims.length!==4)throw Error('Input "attention_bias" is expected to have 4 dimensions');if(j.dims[0]!==L||j.dims[1]!==Q.numHeads||j.dims[2]!==B||j.dims[3]!==D)throw Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)')}return{batchSize:L,sequenceLength:B,pastSequenceLength:R,kvSequenceLength:E,totalSequenceLength:D,maxSequenceLength:A,inputHiddenSize:0,hiddenSize:U,vHiddenSize:k,headSize:P,vHeadSize:Math.floor(k/Q.numHeads),numHeads:Q.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:Q.maskFilterValue,maskType:S,scale:Q.scale,broadcastResPosBias:I,passPastInKv:w,qkvFormat:z}},cN=(J)=>c0({...J}),DX=c0({perm:[0,2,1,3]}),dW=(J,Q,X,Y,H,W,G)=>{let j=[Y,H,W],N=d.size(j),V=[{type:12,data:N},{type:12,data:G},{type:12,data:W}],L=(B)=>{let U=M0("qkv_with_bias",Q.dataType,j),E=a("qkv",Q.dataType,j),R=a("bias",X.dataType,j),A=[{name:"output_size",type:"u32"},{name:"bias_offset",type:"u32"},{name:"hidden_size",type:"u32"}];return`
  ${B.registerUniforms(A).declareVariables(E,R,U)}
  ${B.mainStart()}
    ${B.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let bias_offset_idx = (global_idx % uniforms.hidden_size) + uniforms.bias_offset;

    qkv_with_bias[global_idx] = qkv[global_idx] + bias[bias_offset_idx];
  }`};return J.compute({name:"MultiHeadAttentionAddBias",shaderCache:{inputDependencies:["type","type"]},getRunData:()=>({outputs:[{dims:j,dataType:Q.dataType,gpuDataType:0}],dispatchGroup:{x:Math.ceil(N/64)},programUniforms:V}),getShaderSource:L},{inputs:[Q,X],outputs:[-1]})[0]},v2=(J,Q,X,Y,H,W,G,j)=>{let N=W;if(G&&d.size(G.dims)>0){if(Y===1)throw Error("AddBiasReshape is not implemented. Please export your model with packed QKV or KV");return N=dW(J,W,G,Q,Y,X*H,j),N=N.reshape([Q,Y,X,H]),X===1||Y===1?N:J.compute(x1(N,DX.perm),{inputs:[N],outputs:[-1]})[0]}else return W.dims.length===3&&(N=W.reshape([Q,Y,X,H])),X===1||Y===1?N:J.compute(x1(N,DX.perm),{inputs:[N],outputs:[-1]})[0]},dN=(J,Q)=>{let X=cW(J.inputs,Q),Y=J.inputs[0],H=Z1(J.inputs,1),W=Z1(J.inputs,2),G=Z1(J.inputs,3),j=Z1(J.inputs,4),N=Z1(J.inputs,5),V=Z1(J.inputs,6),L=Z1(J.inputs,7);if(Y.dims.length===5)throw Error("Packed QKV is not implemented");if(H?.dims.length===5)throw Error("Packed KV is not implemented");let B=H&&W&&H.dims.length===4&&W.dims.length===4,U=v2(J,X.batchSize,X.numHeads,X.sequenceLength,X.headSize,Y,G,0);if(B)return f2(J,U,H,W,j,void 0,V,L,N,X);if(!H||!W)throw Error("key and value must be provided");let E=v2(J,X.batchSize,X.numHeads,X.kvSequenceLength,X.headSize,H,G,X.hiddenSize),R=v2(J,X.batchSize,X.numHeads,X.kvSequenceLength,X.vHeadSize,W,G,2*X.hiddenSize);f2(J,U,E,R,j,void 0,V,L,N,X)}}),aN=J0(()=>{A0(),Z0(),J1(),C0(),uW=(J)=>{if(!J||J.length<1)throw Error("too few inputs")},oW=(J,Q)=>{let X=[],Y=Q.numOutputs;return J[1].dims[0]>0&&(J[1].getBigInt64Array().forEach((H)=>X.push(Number(H))),Y=X.length),c0({numOutputs:Y,axis:Q.axis,splitSizes:X})},sW=(J)=>`
fn calculateOutputIndex(index: u32) -> u32 {
    for (var i: u32 = 0u; i < ${J}u; i += 1u ) {
    if (index < ${L0("uniforms.size_in_split_axis","i",J)}) {
        return i;
    }
    }
    return ${J}u;
}`,aW=(J)=>{let Q=J.length,X=[];for(let Y=0;Y<Q;++Y){let H=J[Y].setByIndices("indices","input[global_idx]");Q===1?X.push(H):Y===0?X.push(`if (output_number == ${Y}u) { ${H} }`):Y===Q-1?X.push(`else { ${H} }`):X.push(`else if (output_number == ${Y}) { ${H} }`)}return`
      fn writeBufferData(output_number: u32, indices: ${J[0].type.indices}, global_idx: u32) {
        ${X.join(`
`)}
      }`},eX=(J,Q)=>{let X=J[0].dims,Y=d.size(X),H=J[0].dataType,W=d.normalizeAxis(Q.axis,X.length),G=Array(Q.numOutputs),j=a("input",H,X.length),N=Array(Q.numOutputs),V=[],L=[],B=0,U=[{type:12,data:Y}];for(let R=0;R<Q.numOutputs;R++){B+=Q.splitSizes[R],N[R]=B;let A=X.slice();A[W]=Q.splitSizes[R],L.push(A),G[R]=M0(`output${R}`,H,A.length),V.push({dims:L[R],dataType:J[0].dataType})}U.push({type:12,data:N},...O0(X,...L));let E=(R)=>`
  ${R.registerUniform("input_size","u32").registerUniform("size_in_split_axis","u32",N.length).declareVariables(j,...G)}
  ${sW(N.length)}
  ${aW(G)}

  ${R.mainStart()}
    ${R.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.input_size")}

    var indices = ${j.offsetToIndices("global_idx")};
    var index = ${j.indicesGet("indices",W)};
    let output_number = calculateOutputIndex(index);
    if (output_number != 0) {
      index -= ${L0("uniforms.size_in_split_axis","output_number - 1u",N.length)};
      ${j.indicesSet("indices",W,"index")};
    }
    writeBufferData(output_number, indices, global_idx);
  }`;return{name:"Split",shaderCache:{hint:Q.cacheKey,inputDependencies:["rank"]},getShaderSource:E,getRunData:()=>({outputs:V,dispatchGroup:{x:Math.ceil(Y/64)},programUniforms:U})}},oN=(J,Q)=>{uW(J.inputs);let X=J.inputs.length===1?Q:oW(J.inputs,Q);J.compute(eX(J.inputs,X),{inputs:[0]})},sN=(J)=>{let{axis:Q,splitSizes:X}=J,Y=J.numOutputs<0?X.length:J.numOutputs;if(Y!==X.length)throw Error("numOutputs and splitSizes lengh must be equal");return c0({axis:Q,numOutputs:Y,splitSizes:X})}}),TD=J0(()=>{J1(),R3(),uN(),aN(),u6(),iW=(J,Q)=>{if(Q.doRotary)throw Error("GroupQuerryAttention do_rotary attribute is not supported");if(Q.doRotary&&J.length<=7)throw Error("cos_cache and sin_cache inputs are required if do_rotary is specified");let X=J[0],Y=J[1],H=J[2],W=J[3],G=J[4];if(Q.localWindowSize!==-1)throw Error("Local attention is not supported");if(Q.softcap!==0)throw Error("Softcap is not supported");if(Q.rotaryInterleaved!==0)throw Error("Rotary interleaved is not supported");if(Q.smoothSoftmax)throw Error("Smooth softmax is not supported");if(X.dims.length!==3&&X.dims.length!==5)throw Error("Input query is expected to have 3 or 5 dimensions");let j=!1,N=X.dims[0],V=X.dims[1],L=X.dims.length===3?j?X.dims[2]/3:X.dims[2]:Q.numHeads*X.dims[4],B=V,U=0,E=!Y||Y.dims.length===0,R=Math.floor(E?L/(Q.numHeads+2*Q.kvNumHeads):L/Q.numHeads);E&&(L=R*Q.numHeads);let A=W&&W.dims.length!==0,P=G&&G.dims.length!==0;if(A&&W.dims.length===4&&W.dims[0]===N&&W.dims[1]!==Q.kvNumHeads&&W.dims[2]===Q.kvNumHeads&&W.dims[3]===R)throw Error("BSNH pastKey/pastValue is not supported");if(A&&P){if(W.dims.length!==4)throw Error('Input "past_key" is expected to have 4 dimensions');if(G.dims.length!==4)throw Error('Input "past_value" is expected to have 4 dimensions');U=W.dims[2]}else if(A||P)throw Error('Input "past_key" and "past_value" shall be both present or both absent');let z=1;if(Y&&Y.dims.length>0){if(X.dims.length!==3)throw Error('Input "query" is expected to have 3 dimensions when key is given');if(Y.dims.length<3||Y.dims.length>5)throw Error('Input "key" is expected to have 3, 4, or 5 dimensions');if(X.dims[0]!==Y.dims[0])throw Error('Input "query" and "key" shall have same dim 0 (batch size)');if(Y.dims.length===3){if(X.dims[2]%Y.dims[2]!==0)throw Error('Dimension 2 of "query" should be a multiple of "key"');B=Y.dims[1]}else if(Y.dims.length===5){if(Y.dims[2]!==Q.numHeads||Y.dims[3]!==2||Y.dims[4]!==R)throw Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');if(H)throw Error('Expect "value" be none when "key" has packed kv format.');B=Y.dims[1]}else{if(Y.dims[1]!==Q.numHeads||Y.dims[3]!==R)throw Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');B=Y.dims[2]}}else{if(X.dims.length!==3&&X.dims.length!==5)throw Error('Input "query" is expected to have 3 or 5 dimensions when key is empty');if(X.dims.length===5&&(X.dims[2]!==Q.numHeads||X.dims[3]!==3))throw Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');z=3}let D=0,S=!1,w=Q.kvNumHeads?R*Q.kvNumHeads:L;if(H&&H.dims.length>0){if(H.dims.length!==3&&H.dims.length!==4)throw Error('Input "value" is expected to have 3 or 4 dimensions');if(X.dims[0]!==H.dims[0])throw Error('Input "query" and "value" shall have same dim 0 (batch_size)');if(H.dims.length===3){if(B!==H.dims[1])throw Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');w=H.dims[2]}else{if(B!==H.dims[2])throw Error('Input "past_key" and "past_value" shall have the same dim 2 (kv_sequence_length)');w=H.dims[1]*H.dims[3],S=!0}}let k=J.length>4?J[5]:void 0;if(k&&k.dims.length!==1&&k.dims[0]!==N)throw Error('Input "seqlens" is expected to have 1 dimension and the same dim 0 as batch_size');return{batchSize:N,sequenceLength:V,pastSequenceLength:U,kvSequenceLength:B,totalSequenceLength:-1,maxSequenceLength:-1,inputHiddenSize:0,hiddenSize:L,vHiddenSize:w,headSize:R,vHeadSize:Math.floor(w/Q.kvNumHeads),numHeads:Q.numHeads,kvNumHeads:Q.kvNumHeads,nReps:Q.numHeads/Q.kvNumHeads,pastPresentShareBuffer:!1,maskType:D,scale:Q.scale,broadcastResPosBias:!1,passPastInKv:S,qkvFormat:z}},nW=c0({perm:[0,2,1,3]}),AX=(J,Q,X)=>{let Y=Q,H=X.kvNumHeads;return Q.dims.length===3&&X.kvSequenceLength!==0&&(Y=Q.reshape([X.batchSize,X.kvSequenceLength,H,X.headSize]),Y=J.compute(x1(Y,nW.perm),{inputs:[Y],outputs:[-1]})[0]),Y},iN=(J,Q)=>{let X=iW(J.inputs,Q);if(J.inputs[0].dims.length===5)throw Error("Packed QKV is not implemented");if(J.inputs[1]?.dims.length===5)throw Error("Packed KV is not implemented");let Y=J.inputs[0],H=J.inputs[1]&&J.inputs[1].dims.length>0?J.inputs[1]:void 0,W=J.inputs[2]&&J.inputs[2].dims.length>0?J.inputs[2]:void 0,G=J.inputs[3]&&J.inputs[3].dims.length!==0?J.inputs[3]:void 0,j=J.inputs[4]&&J.inputs[4].dims.length!==0?J.inputs[4]:void 0,N=J.inputs.length>4?J.inputs[5]:void 0,V=J.inputs.length>5?J.inputs[6]:void 0,L=X.kvNumHeads?X.kvNumHeads:X.numHeads,B=c0({axis:2,numOutputs:3,splitSizes:[X.numHeads*X.headSize,L*X.headSize,L*X.headSize]}),[U,E,R]=!H&&!W?J.compute(eX([Y],B),{inputs:[Y],outputs:[-1,-1,-1]}):[Y,H,W],A=v2(J,X.batchSize,X.numHeads,X.sequenceLength,X.headSize,U,void 0,0);f2(J,A,AX(J,E,X),AX(J,R,X),void 0,void 0,G,j,void 0,X,N,V)}}),xD=J0(()=>{A0(),Z0(),u6(),C0(),zX=(J,Q,X,Y,H,W,G,j)=>{let N=t0(W),V=N===1?"f32":`vec${N}f`,L=N===1?"vec2f":`mat2x${N}f`,B=H*G,U=64;B===1&&(U=256);let E=[H,G,W/N],R=[H,G,2],A=["rank","type","type"],P=[];P.push(...O0(E,R));let z=(D)=>{let S=a("x",Q.dataType,3,N),w=a("scale",X.dataType,X.dims),k=a("bias",Y.dataType,Y.dims),I=M0("output",1,3,2),C=[S,w,k,I];return`
  var<workgroup> workgroup_shared : array<${L}, ${U}>;
  const workgroup_size = ${U}u;
  ${D.declareVariables(...C)}
  ${D.mainStart(U)}
    let batch = workgroup_index / uniforms.x_shape[1];
    let channel = workgroup_index % uniforms.x_shape[1];
    let hight = uniforms.x_shape[2];
    // initialize workgroup memory
    var sum = ${V}(0);
    var squared_sum = ${V}(0);
    for (var h = local_idx; h < hight; h += workgroup_size) {
      let value = ${V}(${S.get("batch","channel","h")});
      sum += value;
      squared_sum += value * value;
    }
    workgroup_shared[local_idx] = ${L}(sum, squared_sum);
    workgroupBarrier();

    for (var currSize = workgroup_size >> 1;  currSize > 0; currSize = currSize >> 1) {
      if (local_idx < currSize) {
        workgroup_shared[local_idx] = workgroup_shared[local_idx] + workgroup_shared[local_idx + currSize];
      }
      workgroupBarrier();
    }
    if (local_idx == 0) {
      let sum_final = ${d6("workgroup_shared[0][0]",N)} / f32(hight * ${N});
      let squared_sum_final = ${d6("workgroup_shared[0][1]",N)} / f32(hight * ${N});

      let inv_std_dev = inverseSqrt(squared_sum_final - sum_final * sum_final + f32(${j}));
      let channel_scale = inv_std_dev * f32(scale[channel]);
      let channel_shift = f32(bias[channel]) - sum_final * channel_scale;
      output[workgroup_index] = vec2f(channel_scale, channel_shift);
    }
  }`};return J.compute({name:"InstanceNormComputeChannelScaleShift",shaderCache:{hint:`${N};${j};${U}`,inputDependencies:A},getRunData:()=>({outputs:[{dims:R,dataType:1}],dispatchGroup:{x:B},programUniforms:P}),getShaderSource:z},{inputs:[Q,X,Y],outputs:[-1]})[0]},rW=(J,Q,X)=>{let Y=Q[0].dims,H=Y,W=2,G=Y[0],j=Y[1],N=d.sizeFromDimension(Y,W),V=t0(N),L=d.size(H)/V,B=zX(J,Q[0],Q[1],Q[2],G,N,j,X.epsilon),U=[G,j,N/V],E=[G,j],R=["type","none"],A=(P)=>{let z=a("x",Q[0].dataType,U.length,V),D=a("scale_shift",1,E.length,2),S=M0("output",Q[0].dataType,U.length,V),w=[z,D,S];return`
  ${P.registerUniform("output_size","u32").declareVariables(...w)}
  ${P.mainStart()}
  ${P.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let outputIndices = ${S.offsetToIndices("global_idx")};
      let batch = outputIndices[0];
      let channel = outputIndices[1];
      let scale_shift = ${D.getByIndices("vec2<u32>(batch, channel)")};
      let value = ${z.getByOffset("global_idx")} * ${S.type.value}(scale_shift.x) + ${S.type.value}(scale_shift.y);
      ${S.setByOffset("global_idx","value")};
  }`};J.compute({name:"InstanceNormalization",shaderCache:{hint:`${V}`,inputDependencies:R},getRunData:()=>({outputs:[{dims:H,dataType:Q[0].dataType}],dispatchGroup:{x:Math.ceil(L/64)},programUniforms:[{type:12,data:L},...O0(U,E,U)]}),getShaderSource:A},{inputs:[Q[0],B]})},tW=(J,Q,X)=>{let Y=Q[0].dims,H=Y,W=Y[0],G=Y[Y.length-1],j=d.sizeFromDimension(Y,1)/G,N=t0(G),V=d.size(H)/N,L=[{type:12,data:j},{type:12,data:Math.floor(G/N)}],B=["type","type"],U=!1,E=[0,Y.length-1];for(let z=0;z<Y.length-2;z++)U=U||Y[z+1]!==1,E.push(z+1);U=U&&Y[Y.length-1]!==1;let R=U?J.compute(x1(J.inputs[0],E),{inputs:[J.inputs[0]],outputs:[-1]})[0]:J.inputs[0].reshape(Array.from({length:Y.length},(z,D)=>Y[E[D]])),A=zX(J,R,Q[1],Q[2],W,j,G,X.epsilon),P=(z)=>{let D=N1(Q[0].dataType),S=N===1?"vec2f":`mat${N}x2f`,w=(C)=>{let T=C===0?"x":"y",g=N===1?"f32":`vec${N}f`;switch(N){case 1:return`${D}(${g}(scale.${T}))`;case 2:return`vec2<${D}>(${g}(scale[0].${T}, scale[1].${T}))`;case 4:return`vec4<${D}>(${g}(scale[0].${T}, scale[1].${T}, scale[2].${T}, scale[3].${T}))`;default:throw Error(`Not supported compoents ${N}`)}},k=a("input",Q[0].dataType,Q[0].dims,N),I=M0("output",Q[0].dataType,H,N);return`
  @group(0) @binding(0) var<storage, read> input : array<${k.type.storage}>;
  @group(0) @binding(1) var<storage, read> scale_input : array<${S}>;
  @group(0) @binding(2) var<storage, read_write> output : array<${I.type.storage}>;
  struct Uniforms {H: u32, C : u32};
  @group(0) @binding(3) var<uniform> uniforms: Uniforms;

  ${z.mainStart()}
    let current_image_number = global_idx / (uniforms.C * uniforms.H);
    let current_channel_number = global_idx % uniforms.C;

    let scale_offset = current_image_number * uniforms.C + current_channel_number;
    let scale = scale_input[scale_offset];
    output[global_idx] = fma(input[global_idx], ${w(0)}, ${w(1)});
  }`};J.compute({name:"InstanceNormalizationNHWC",shaderCache:{hint:`${N}`,inputDependencies:B},getRunData:()=>({outputs:[{dims:H,dataType:Q[0].dataType}],dispatchGroup:{x:Math.ceil(V/64)},programUniforms:L}),getShaderSource:P},{inputs:[Q[0],A]})},nN=(J,Q)=>{Q.format==="NHWC"?tW(J,J.inputs,Q):rW(J,J.inputs,Q)}}),fD=J0(()=>{A0(),Z0(),C0(),eW=(J)=>{if(!J||J.length<2)throw Error("layerNorm requires at least 2 inputs.")},JG=(J,Q,X)=>{let Y=Q.simplified,H=J[0].dims,W=J[1],G=!Y&&J[2],j=H,N=d.normalizeAxis(Q.axis,H.length),V=d.sizeToDimension(H,N),L=d.sizeFromDimension(H,N),B=d.size(W.dims),U=G?d.size(G.dims):0;if(B!==L||G&&U!==L)throw Error(`Size of X.shape()[axis:] == ${L}.
       Size of scale and bias (if provided) must match this.
       Got scale size of ${B} and bias size of ${U}`);let E=[];for(let k=0;k<H.length;++k)k<N?E.push(H[k]):E.push(1);let R=t0(L),A=["type","type"],P=[{type:12,data:V},{type:1,data:L},{type:12,data:Math.floor(L/R)},{type:1,data:Q.epsilon}];G&&A.push("type");let z=X>1,D=X>2,S=(k)=>{let I=N1(J[0].dataType),C=[a("x",J[0].dataType,J[0].dims,R),a("scale",W.dataType,W.dims,R)];G&&C.push(a("bias",G.dataType,G.dims,R)),C.push(M0("output",J[0].dataType,j,R)),z&&C.push(M0("mean_data_output",1,E)),D&&C.push(M0("inv_std_output",1,E));let T=[{name:"norm_count",type:"u32"},{name:"norm_size",type:"f32"},{name:"norm_size_vectorized",type:"u32"},{name:"epsilon",type:"f32"}];return`
  ${k.registerUniforms(T).declareVariables(...C)}
  ${k.mainStart()}
    ${k.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.norm_count")}
    let offset = global_idx * uniforms.norm_size_vectorized;
    var mean_vector = ${dX("f32",R)};
    var mean_square_vector = ${dX("f32",R)};

    for (var h: u32 = 0u; h < uniforms.norm_size_vectorized; h++) {
      let value = ${e8(I,R,"x[h + offset]")};
      mean_vector += value;
      mean_square_vector += value * value;
    }
    let mean = ${d6("mean_vector",R)} / uniforms.norm_size;
    let inv_std_dev = inverseSqrt(${d6("mean_square_vector",R)} / uniforms.norm_size ${Y?"":"- mean * mean"} + uniforms.epsilon);

    for (var j: u32 = 0; j < uniforms.norm_size_vectorized; j++) {
      let f32input = ${e8(I,R,"x[j + offset]")};
      let f32scale = ${e8(I,R,"scale[j]")};
      output[j + offset] = ${C[0].type.value}((f32input ${Y?"":"- mean"}) * inv_std_dev * f32scale
        ${G?`+ ${e8(I,R,"bias[j]")}`:""}
      );
    }

    ${z?"mean_data_output[global_idx] = mean":""};
    ${D?"inv_std_output[global_idx] = inv_std_dev":""};
  }`},w=[{dims:j,dataType:J[0].dataType}];return z&&w.push({dims:E,dataType:1}),D&&w.push({dims:E,dataType:1}),{name:"LayerNormalization",shaderCache:{hint:`${R};${X};${Y}`,inputDependencies:A},getRunData:()=>({outputs:w,dispatchGroup:{x:Math.ceil(V/64)},programUniforms:P}),getShaderSource:S}},rN=(J,Q)=>{eW(J.inputs),J.compute(JG(J.inputs,Q,J.outputCount))}}),hD=J0(()=>{Z0(),$3(),P3(),QG=(J)=>{if(!J||J.length!==2)throw Error("MatMul requires 2 inputs.");if(J[0].dims[J[0].dims.length-1]!==J[1].dims[J[1].dims.length-2])throw Error("shared dimension does not match.")},tN=(J)=>{QG(J.inputs);let Q=J7.calcShape(J.inputs[0].dims,J.inputs[1].dims,!0);if(!Q)throw Error("Can't use matmul on the given tensors");let X=Q[Q.length-1],Y=J.inputs[0].dims[J.inputs[0].dims.length-1];if(X<8&&Y<8)J.compute(z3(J.inputs,{activation:""},Q));else{let H=Q[Q.length-2],W=d.size(J.inputs[0].dims.slice(0,-2)),G=d.size(J.inputs[1].dims.slice(0,-2));if(W!==1&&H===1&&G===1){let j=J.inputs[0].reshape([1,W,Y]),N=J.inputs[1].reshape([1,Y,X]),V=[1,W,X],L=[j,N];J.compute(p5(L,{activation:""},Q,V),{inputs:L})}else J.compute(p5(J.inputs,{activation:""},Q))}}}),yD=J0(()=>{A0(),Z0(),J1(),C0(),XG=(J,Q)=>{if(J.length<3||J.length>4)throw Error("MatMulNBits requires 3 or 4 inputs");let X=J[0],Y=X.dims.length;if(X.dims[Y-1]!==Q.k)throw Error("The last dim of input shape does not match the k value");let H=Math.floor((Q.k+Q.blockSize-1)/Q.blockSize),W=Q.blockSize/8*Q.bits,G=J[1];if(!d.areEqual(G.dims,[Q.n,H,W]))throw Error("The second inputs must be 3D tensor with shape N X nBlocksPerCol X blobSize");let j=J[2].dims;if(d.size(j)!==Q.n*H)throw Error("scales input size error.");if(J.length===4){let N=J[3].dims,V=Q.bits>4?Q.n*H:Q.n*Math.floor((H+1)/2);if(d.size(N)!==V)throw Error("zeroPoints input size error.")}},YG=(J,Q)=>{let X=J[0].dims,Y=X.length,H=X[Y-2],W=Q.k,G=Q.n,j=X.slice(0,Y-2),N=d.size(j),V=J[1].dims[2]/4,L=J[0].dataType,B=t0(Q.k),U=t0(V),E=t0(G),R=j.concat([H,G]),A=H>1&&G/E%2===0?2:1,P=d.size(R)/E/A,z=64,D=[],S=[N,H,W/B],w=d.convertShape(J[1].dims).slice();w.splice(-1,1,V/U),D.push(...O0(S)),D.push(...O0(w)),D.push(...O0(J[2].dims)),J.length===4&&D.push(...O0(d.convertShape(J[3].dims)));let k=[N,H,G/E];D.push(...O0(k));let I=(C)=>{let T=S.length,g=a("a",J[0].dataType,T,B),m=a("b",12,w.length,U),l=a("scales",J[2].dataType,J[2].dims.length),t=[g,m,l],h=J.length===4?a("zero_points",12,J[3].dims.length):void 0;h&&t.push(h);let W0=k.length,j0=M0("output",J[0].dataType,W0,E),o=N1(J[0].dataType),G0=(()=>{switch(B){case 1:return`array<${o}, 8>`;case 2:return`mat4x2<${o}>`;case 4:return`mat2x4<${o}>`;default:throw Error(`${B}-component is not supported.`)}})(),F0=()=>{let f=`
          // reuse a data
            var input_offset = ${g.indicesToOffset(`${g.type.indices}(batch, row, word_offset)`)};
            var a_data: ${G0};
            for (var j: u32 = 0; j < ${8/B}; j++) {
              a_data[j] = ${g.getByOffset("input_offset")};
              input_offset++;
            }
          `;for(let p=0;p<E*A;p++)f+=`
            b_value = ${U===1?`b${p}_data`:`b${p}_data[i]`};
            b_value_lower = unpack4xU8(b_value & b_mask);
            b_value_upper = unpack4xU8((b_value >> 4) & b_mask);
            b_quantized_values = ${G0}(${Array.from({length:4},(v,r)=>`${o}(b_value_lower[${r}]), ${o}(b_value_upper[${r}])`).join(", ")});
            b_dequantized_values = ${B===1?`${G0}(${Array.from({length:8},(v,r)=>`(b_quantized_values[${r}] - ${h?`zero_point${p}`:"zero_point"}) * scale${p}`).join(", ")});`:`(b_quantized_values - ${G0}(${Array(8).fill(`${h?`zero_point${p}`:"zero_point"}`).join(",")})) * scale${p};`};
            workgroup_shared[local_id.x * ${A} + ${Math.floor(p/E)}]${E>1?`[${p%E}]`:""} += ${Array.from({length:8/B},(v,r)=>`${B===1?`a_data[${r}] * b_dequantized_values[${r}]`:`dot(a_data[${r}], b_dequantized_values[${r}])`}`).join(" + ")};
          `;return f},s=()=>{let f=`
            var col_index = col * ${E};
            ${h?`
            let zero_point_bytes_per_col = (nBlocksPerCol + 1) / 2;
            var zero_point_byte_count: u32;
            var zero_point_word_index: u32;
            var zero_point_byte_offset: u32;
            let zero_point_nibble_offset: u32 = block & 0x1u;
            var zero_point_bits_offset: u32;
            var zero_point_word: u32;`:`
            // The default zero point is 8 for unsigned 4-bit quantization.
            let zero_point = ${o}(8);`}
            `;for(let p=0;p<E*A;p++)f+=`
            let scale${p} = ${l.getByOffset("col_index * nBlocksPerCol + block")};
            ${h?`
            zero_point_byte_count = col_index * zero_point_bytes_per_col + (block >> 0x1u);
            zero_point_word_index = zero_point_byte_count >> 0x2u;
            zero_point_byte_offset = zero_point_byte_count & 0x3u;
            zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_nibble_offset << 2);
            zero_point_word = ${h.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point${p} = ${o}((zero_point_word) & 0xFu);`:""}
            col_index += 1;`;return f},N0=()=>{let f=`col_index = col * ${E};`;for(let p=0;p<E*A;p++)f+=`
            let b${p}_data = ${m.getByIndices(`${m.type.indices}(col_index, block, word)`)};
            col_index += 1;`;return f+=`
            var b_value: u32;
            let b_mask: u32 = 0x0F0F0F0Fu;
            var b_value_lower: vec4<u32>;
            var b_value_upper: vec4<u32>;
            var b_quantized_values: ${G0};
            var b_dequantized_values: ${G0};`,f};return`
        var<workgroup> workgroup_shared: array<${j0.type.value}, ${A*z}>;
        ${C.declareVariables(...t,j0)}
        ${C.mainStart([z,1,1])}
          let output_indices = ${j0.offsetToIndices(`(global_idx / ${z}) * ${A}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let nBlocksPerCol = uniforms.b_shape[1];

          for (var block = local_id.x; block < nBlocksPerCol; block += ${z}) {
            //process one block
            var word_offset: u32 = block * ${Q.blockSize/B};
            ${s()}
            for (var word: u32 = 0; word < ${V}; word += ${U}) {
              ${N0()}
              for (var i: u32 = 0; i < ${U}; i++) {
                ${F0()}
                word_offset += ${8/B};
              }
            }
          }
          workgroupBarrier();

          if (local_id.x < ${A}) {
            var output_value: ${j0.type.value} = ${j0.type.value}(0);
            var workgroup_shared_offset: u32 = local_id.x;
            for (var b: u32 = 0u; b < ${z}u; b++) {
              output_value += workgroup_shared[workgroup_shared_offset];
              workgroup_shared_offset += ${A};
            }
            ${j0.setByIndices(`${j0.type.indices}(batch, row, col + local_id.x)`,"output_value")};
          }
        }`};return{name:"MatMulNBits",shaderCache:{hint:`${Q.blockSize};${Q.bits};${B};${U};${E};${A};${z}`,inputDependencies:Array(J.length).fill("rank")},getRunData:()=>({outputs:[{dims:R,dataType:L}],dispatchGroup:{x:P},programUniforms:D}),getShaderSource:I}},HG=(J,Q)=>{let X=J[0].dims,Y=X.length,H=X[Y-2],W=Q.k,G=Q.n,j=X.slice(0,Y-2),N=d.size(j),V=J[1].dims[2]/4,L=J[0].dataType,B=t0(Q.k),U=t0(V),E=j.concat([H,G]),R=128,A=G%8===0?8:G%4===0?4:1,P=R/A,z=P*U*8,D=z/B,S=z/Q.blockSize,w=d.size(E)/A,k=[],I=[N,H,W/B],C=d.convertShape(J[1].dims).slice();C.splice(-1,1,V/U),k.push(...O0(I)),k.push(...O0(C)),k.push(...O0(J[2].dims)),J.length===4&&k.push(...O0(d.convertShape(J[3].dims)));let T=[N,H,G];k.push(...O0(T));let g=(m)=>{let l=I.length,t=a("a",J[0].dataType,l,B),h=a("b",12,C.length,U),W0=a("scales",J[2].dataType,J[2].dims.length),j0=[t,h,W0],o=J.length===4?a("zero_points",12,J[3].dims.length):void 0;o&&j0.push(o);let G0=T.length,F0=M0("output",J[0].dataType,G0),s=N1(J[0].dataType),N0=()=>{switch(B){case 1:return`
          let a_data0 = vec4<${s}>(sub_a[word_offset], sub_a[word_offset + 1], sub_a[word_offset + 2], sub_a[word_offset + 3]);
          let a_data1 = vec4<${s}>(sub_a[word_offset + 4], sub_a[word_offset + 5], sub_a[word_offset + 6], sub_a[word_offset + 7]);`;case 2:return`
          let a_data0 = vec4<${s}>(sub_a[word_offset], sub_a[word_offset + 1]);
          let a_data1 = vec4<${s}>(sub_a[word_offset + 2], sub_a[word_offset + 3]);`;case 4:return`
          let a_data0 = sub_a[word_offset];
          let a_data1 = sub_a[word_offset + 1];`;default:throw Error(`${B}-component is not supported.`)}};return`
        var<workgroup> sub_a: array<${t.type.value}, ${D}>;
        var<workgroup> inter_results: array<array<${F0.type.value}, ${P}>, ${A}>;
        ${m.declareVariables(...j0,F0)}
        ${m.mainStart([P,A,1])}
          let output_indices = ${F0.offsetToIndices(`workgroup_index * ${A}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let n_blocks_per_col = uniforms.b_shape[1];
          let num_tiles =  (n_blocks_per_col - 1) / ${S} + 1;

          // Loop over shared dimension.
          for (var tile: u32 = 0; tile < num_tiles; tile += 1) {
            let a_col_start = tile * ${D};
            // load one tile A data into shared memory.
            for (var a_offset = local_idx; a_offset < ${D}; a_offset += ${R})
            {
              let a_col = a_col_start + a_offset;
              if (a_col < uniforms.a_shape[2])
              {
                sub_a[a_offset] = ${t.getByIndices(`${t.type.indices}(batch, row, a_col)`)};
              } else {
                sub_a[a_offset] = ${t.type.value}(0);
              }
            }
            workgroupBarrier();

            // each thread process one block
            let b_row = col + local_id.y;
            let block = tile * ${S} + local_id.x;
            ${o?`
            let zero_point_bytes_per_col = (n_blocks_per_col + 1) / 2;
            let zero_point_byte_count = b_row * zero_point_bytes_per_col + (block >> 0x1u);
            let zero_point_word_index = zero_point_byte_count >> 0x2u;
            let zero_point_byte_offset = zero_point_byte_count & 0x3u;
            let zero_point_nibble_offset: u32 = block & 0x1u;
            let zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_nibble_offset << 2);
            let zero_point_word = ${o.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point = ${s}((zero_point_word) & 0xFu);`:`
            // The default zero point is 8 for unsigned 4-bit quantization.
            let zero_point = ${s}(8);`}
            let scale = ${W0.getByOffset("b_row * n_blocks_per_col + block")};
            let b_data = ${h.getByIndices(`${h.type.indices}(b_row, block, 0)`)};
            var word_offset = local_id.x * ${Q.blockSize/B};
            for (var i: u32 = 0; i < ${U}; i++) {
              ${N0()}
              let b_value = ${U===1?"b_data":"b_data[i]"};
              let b_value_lower = unpack4xU8(b_value & 0x0F0F0F0Fu);
              let b_value_upper = unpack4xU8((b_value >> 4) & 0x0F0F0F0Fu);
              let b_quantized_values = mat2x4<${s}>(${Array.from({length:4},(f,p)=>`${s}(b_value_lower[${p}]), ${s}(b_value_upper[${p}])`).join(", ")});
              let b_dequantized_values = (b_quantized_values - mat2x4<${s}>(${Array(8).fill("zero_point").join(",")})) * scale;
              inter_results[local_id.y][local_id.x] += ${Array.from({length:2},(f,p)=>`${`dot(a_data${p}, b_dequantized_values[${p}])`}`).join(" + ")};
              word_offset += ${8/B};
            }
            workgroupBarrier();
          }

          if (local_idx < ${A}) {
            var output_value: ${F0.type.value} = ${F0.type.value}(0);
            for (var b = 0u; b < ${P}; b++) {
              output_value += inter_results[local_idx][b];
            }
            if (col + local_idx < uniforms.output_shape[2])
            {
              ${F0.setByIndices(`${F0.type.indices}(batch, row, col + local_idx)`,"output_value")}
            }
          }
        }`};return{name:"BlockwiseMatMulNBits32",shaderCache:{hint:`${Q.blockSize};${B};${U};${P};${A}`,inputDependencies:Array(J.length).fill("rank")},getRunData:()=>({outputs:[{dims:E,dataType:L}],dispatchGroup:{x:w},programUniforms:k}),getShaderSource:g}},eN=(J,Q)=>{XG(J.inputs,Q),Q.blockSize===32&&J.adapterInfo.isVendor("intel")&&J.adapterInfo.isArchitecture("gen-12lp")?J.compute(HG(J.inputs,Q)):J.compute(YG(J.inputs,Q))},JV=(J)=>c0(J)}),gD=J0(()=>{A0(),Z0(),C0(),qG=(J)=>{if(!J||J.length<1)throw Error("Too few inputs");if(J[0].dataType!==1&&J[0].dataType!==10)throw Error("Input type must be float or float16.");if(J.length>=2){let Q=J[0].dims.length*2===J[1].dims[0];if(J.length===4&&(Q=J[3].dims[0]*2===J[1].dims[0]),!Q)throw Error("The pads should be a 1D tensor of shape [2 * input_rank] or [2 * num_axes].")}},WG=(J,Q,X)=>{let Y="";for(let H=Q-1;H>=0;--H)Y+=`
            k = i32(${J.indicesGet("indices",H)}) - ${L0("uniforms.pads",H,X)};
            if (k < 0) {
              break;
            }
            if (k >= i32(${L0("uniforms.x_shape",H,Q)})) {
              break;
            }
            offset += k * i32(${L0("uniforms.x_strides",H,Q)});
        `;return`
          value = ${J.type.value}(uniforms.constant_value);
          for (var i = 0; i < 1; i++) {
            var offset = 0;
            var k = 0;
            ${Y}
            value = x[offset];
          }
      `},GG=(J,Q,X)=>{let Y="";for(let H=Q-1;H>=0;--H)Y+=`
                k = i32(${J.indicesGet("indices",H)}) - ${L0("uniforms.pads",H,X)};
                if (k < 0) {
                  k = -k;
                }
                {
                  let _2n_1 = 2 * (i32(${L0("uniforms.x_shape",H,Q)}) - 1);
                  k = k % _2n_1;
                  if(k >= i32(${L0("uniforms.x_shape",H,Q)})) {
                    k = _2n_1 - k;
                  }
                }
                offset += k * i32(${L0("uniforms.x_strides",H,Q)});
            `;return`
              var offset = 0;
              var k = 0;
              ${Y}
              value = x[offset];
          `},jG=(J,Q,X)=>{let Y="";for(let H=Q-1;H>=0;--H)Y+=`
                k = i32(${J.indicesGet("indices",H)}) - ${L0("uniforms.pads",H,X)};
                if (k < 0) {
                  k = 0;
                }
                if (k >= i32(${L0("uniforms.x_shape",H,Q)})) {
                  k = i32(${L0("uniforms.x_shape",H,Q)}) - 1;
                }
                offset += k * i32(${L0("uniforms.x_strides",H,Q)});
            `;return`
              var offset = 0;
              var k = 0;
              ${Y}
              value = x[offset];
          `},FG=(J,Q,X)=>{let Y="";for(let H=Q-1;H>=0;--H)Y+=`
                k = i32(${J.indicesGet("indices",H)}) - ${L0("uniforms.pads",H,X)};
                if (k < 0)  {
                  k += i32(${L0("uniforms.x_shape",H,Q)}]);
                }
                if (k >= i32(${L0("uniforms.x_shape",H,Q)})) {
                  k -= i32(${L0("uniforms.x_shape",H,Q)});
                }
                offset += k * i32(${L0("uniforms.x_strides",H,Q)});
            `;return`
              var offset = 0;
              var k = 0;
              ${Y}
              value = x[offset];
          `},NG=(J,Q,X)=>{switch(X.mode){case 0:return WG(J,Q,X.pads.length);case 1:return GG(J,Q,X.pads.length);case 2:return jG(J,Q,X.pads.length);case 3:return FG(J,Q,X.pads.length);default:throw Error("Invalid mode")}},VG=(J,Q)=>{let X=d.padShape(J[0].dims.slice(),Q.pads),Y=J[0].dims,H=d.size(X),W=[{type:12,data:H},{type:6,data:Q.pads}],G=J.length>=3&&J[2].data;Q.mode===0&&W.push({type:G?J[2].dataType:1,data:Q.value}),W.push(...O0(J[0].dims,X));let j=["rank"],N=(V)=>{let L=M0("output",J[0].dataType,X.length),B=a("x",J[0].dataType,Y.length),U=B.type.value,E=NG(L,Y.length,Q),R=[{name:"output_size",type:"u32"},{name:"pads",type:"i32",length:Q.pads.length}];return Q.mode===0&&R.push({name:"constant_value",type:G?U:"f32"}),`
            ${V.registerUniforms(R).declareVariables(B,L)}
            ${V.mainStart()}
            ${V.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

            let indices = ${L.offsetToIndices("global_idx")};

            var value = ${U}(0);
            ${E}
            output[global_idx] = value;
        }`};return{name:"Pad",shaderCache:{hint:`${Q.mode}${G}`,inputDependencies:j},getRunData:()=>({outputs:[{dims:X,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(d.size(X)/64)},programUniforms:W}),getShaderSource:N}},KG=(J,Q)=>{if(J.length>1){let X=J[1].getBigInt64Array(),Y=J.length>=3&&J[2].data?J[2].dataType===10?J[2].getUint16Array()[0]:J[2].getFloat32Array()[0]:0,H=J[0].dims.length,W=new Int32Array(2*H).fill(0);if(J.length>=4){let j=J[3].getBigInt64Array();for(let N=0;N<j.length;N++)W[Number(j[N])]=Number(X[N]),W[Number(j[N])+H]=Number(X[N+j.length])}else X.forEach((j,N)=>W[Number(N)]=Number(j));let G=[];return W.forEach((j)=>G.push(j)),{mode:Q.mode,value:Y,pads:G}}else return Q},QV=(J,Q)=>{qG(J.inputs);let X=KG(J.inputs,Q);J.compute(VG(J.inputs,X),{inputs:[0]})}}),lD=J0(()=>{q6(),A0(),Z0(),C0(),w2=(J)=>{if(a0.webgpu.validateInputContent&&(!J||J.length!==1))throw Error("Pool ops requires 1 input.")},$X=(J,Q,X)=>{let Y=Q.format==="NHWC",H=J.dims.slice();Y&&H.splice(1,0,H.pop());let W=Object.hasOwnProperty.call(Q,"dilations"),G=Q.kernelShape.slice(),j=Q.strides.slice(),N=W?Q.dilations.slice():[],V=Q.pads.slice();l5.adjustPoolAttributes(X,H,G,j,N,V);let L=l5.computePoolOutputShape(X,H,j,N,G,V,Q.autoPad),B=Object.assign({},Q);W?Object.assign(B,{kernelShape:G,strides:j,pads:V,dilations:N,cacheKey:Q.cacheKey}):Object.assign(B,{kernelShape:G,strides:j,pads:V,cacheKey:Q.cacheKey});let U=L.slice();return U.push(U.splice(1,1)[0]),[B,Y?U:L]},PX=(J,Q)=>{let X=Q.format==="NHWC",Y=d.size(J),H=d.size(Q.kernelShape),W=[{type:12,data:Y},{type:12,data:H}],G=[{name:"outputSize",type:"u32"},{name:"kernelSize",type:"u32"}];if(Q.kernelShape.length<=2){let j=Q.kernelShape[Q.kernelShape.length-1],N=Q.strides[Q.strides.length-1],V=Q.pads[Q.pads.length/2-1],L=Q.pads[Q.pads.length-1],B=!!(V+L);W.push({type:12,data:j},{type:12,data:N},{type:12,data:V},{type:12,data:L}),G.push({name:"kw",type:"u32"},{name:"sw",type:"u32"},{name:"pwStart",type:"u32"},{name:"pwEnd",type:"u32"});let U=!1;if(Q.kernelShape.length===2){let E=Q.kernelShape[Q.kernelShape.length-2],R=Q.strides[Q.strides.length-2],A=Q.pads[Q.pads.length/2-2],P=Q.pads[Q.pads.length-2];U=!!(A+P),W.push({type:12,data:E},{type:12,data:R},{type:12,data:A},{type:12,data:P}),G.push({name:"kh",type:"u32"},{name:"sh",type:"u32"},{name:"phStart",type:"u32"},{name:"phEnd",type:"u32"})}return[W,G,!0,B,U]}else{if(X)throw Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");let j=d.computeStrides(Q.kernelShape);W.push({type:12,data:j},{type:12,data:Q.pads},{type:12,data:Q.strides}),G.push({name:"kernelStrides",type:"u32",length:j.length},{name:"pads",type:"u32",length:Q.pads.length},{name:"strides",type:"u32",length:Q.strides.length});let N=Q.pads.reduce((V,L)=>V+L);return[W,G,!!N,!1,!1]}},SX=(J,Q,X,Y,H,W,G,j,N,V,L,B)=>{let U=H.format==="NHWC",E=Q.type.value,R=M0("output",Q.type.tensor,Y);if(H.kernelShape.length<=2){let A="",P="",z="",D=X-(U?2:1);if(L?A=`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${D}] = indices[${D}] * uniforms.sw - uniforms.pwStart + i;
                  if (xIndices[${D}] < 0 || xIndices[${D}]
                      >= uniforms.x_shape[${D}]) {
                    pad++;
                    continue;
                  }
                  let x_val = x[${Q.indicesToOffset("xIndices")}];
                  ${W}
                }`:A=`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${D}] = indices[${D}] * uniforms.sw - uniforms.pwStart + i;
                  let x_val = x[${Q.indicesToOffset("xIndices")}];
                  ${W}
                }`,H.kernelShape.length===2){let S=X-(U?3:2);B?P=`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${S}] = indices[${S}] * uniforms.sh - uniforms.phStart + j;
                  if (xIndices[${S}] < 0 || xIndices[${S}] >= uniforms.x_shape[${S}]) {
                    pad += i32(uniforms.kw);
                    continue;
                  }
              `:P=`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${S}] = indices[${S}] * uniforms.sh - uniforms.phStart + j;
                `,z=`
              }
            `}return`
            ${J.registerUniforms(N).declareVariables(Q,R)}

            ${J.mainStart()}
              ${J.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

              let indices = ${R.offsetToIndices("global_idx")};
              var xIndices = ${R.offsetToIndices("global_idx")};

              var value = ${E}(${j});
              var pad = 0;
              ${P}
              ${A}
              ${z}
              ${G}

              output[global_idx] = value;
            }`}else{if(U)throw Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");let A=H.kernelShape.length,P=H.pads.length,z="";return V?z=`
                if (xIndices[j] >= uniforms.x_shape[j]) {
                  pad++;
                  isPad = true;
                  break;
                }
              }
              if (!isPad) {
                let x_val = x[${Q.indicesToOffset("xIndices")}];
                ${W}
              }`:z=`
              }
              let x_val = x[${Q.indicesToOffset("xIndices")}];
              ${W}
            `,`
            ${J.registerUniforms(N).declareVariables(Q,R)}

            ${J.mainStart()}
              ${J.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
              let indices = ${R.offsetToIndices("global_idx")};
              var xIndices = ${R.offsetToIndices("global_idx")};

              var offsets: array<u32, ${A}>;

              var value = ${E}(${j});
              var pad = 0;
              var isPad = false;

              for (var i: u32 = 0u; i < uniforms.kernelSize; i++) {
                var offset = i;
                for (var j = 0u; j < ${A-1}u; j++) {
                  offsets[j] = offset / ${L0("uniforms.kernelStrides","j",A)};
                  offset -= offsets[j] * ${L0("uniforms.kernelStrides","j",A)};
                }
                offsets[${A-1}] = offset;

                isPad = false;
                for (var j = ${X-A}u; j < ${X}u; j++) {
                  xIndices[j] = indices[j] * ${L0("uniforms.strides",`j - ${X-A}u`,A)}
                    + offsets[j - ${X-A}u] - ${L0("uniforms.pads","j - 2u",P)};
                  ${z}
              }
              ${G}

              output[global_idx] = value;
            }`}},ZX=(J)=>`${J.format};${J.ceilMode};${J.autoPad};${J.kernelShape.length}`,MG=(J)=>`${ZX(J)};${J.countIncludePad}`,BG=(J)=>`${ZX(J)};${J.storageOrder};${J.dilations}`,wX=(J)=>({format:J.format,autoPad:["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][J.auto_pad],ceilMode:J.ceil_mode,kernelShape:J.kernel_shape,strides:J.strides,pads:J.pads}),kX=(J,Q,X,Y)=>{let[H,W]=$X(Q,Y,X),G=a("x",Q.dataType,Q.dims.length),j=G.type.value,N="value += x_val;",V="";H.countIncludePad?V+=`value /= ${j}(uniforms.kernelSize);`:V+=`value /= ${j}(i32(uniforms.kernelSize) - pad);`;let[L,B,U,E,R]=PX(W,H);L.push(...O0(Q.dims,W));let A=["rank"];return{name:J,shaderCache:{hint:`${Y.cacheKey};${U};${E};${R}`,inputDependencies:A},getRunData:()=>({outputs:[{dims:W,dataType:Q.dataType}],dispatchGroup:{x:Math.ceil(d.size(W)/64)},programUniforms:L}),getShaderSource:(P)=>SX(P,G,Q.dims.length,W.length,H,N,V,0,B,U,E,R)}},XV=(J)=>{let Q=J.count_include_pad!==0,X=wX(J);if(X.ceilMode!==0)throw Error("using ceil() in shape computation is not yet supported for AveragePool");let Y={countIncludePad:Q,...X,cacheKey:""};return{...Y,cacheKey:MG(Y)}},YV=(J,Q)=>{w2(J.inputs),J.compute(kX("AveragePool",J.inputs[0],!1,Q))},CX={autoPad:"",ceilMode:0,countIncludePad:!1,kernelShape:[],strides:[],pads:[],storageOrder:0,dilations:[]},HV=(J)=>{let Q=J.format;return{format:Q,...CX,cacheKey:Q}},qV=(J,Q)=>{w2(J.inputs),J.compute(kX("GlobalAveragePool",J.inputs[0],!0,Q))},IX=(J,Q,X,Y)=>{let[H,W]=$X(Q,Y,X),G=`
      value = max(x_val, value);
    `,j="",N=a("x",Q.dataType,Q.dims.length),V=["rank"],[L,B,U,E,R]=PX(W,H);return L.push(...O0(Q.dims,W)),{name:J,shaderCache:{hint:`${Y.cacheKey};${U};${E};${R}`,inputDependencies:V},getRunData:()=>({outputs:[{dims:W,dataType:Q.dataType}],dispatchGroup:{x:Math.ceil(d.size(W)/64)},programUniforms:L}),getShaderSource:(A)=>SX(A,N,Q.dims.length,W.length,H,G,j,Q.dataType===10?-65504:-1e5,B,U,E,R)}},WV=(J,Q)=>{w2(J.inputs),J.compute(IX("MaxPool",J.inputs[0],!1,Q))},GV=(J)=>{let{storage_order:Q,dilations:X}=J,Y=wX(J);if(Q!==0)throw Error("column major storage order is not yet supported for MaxPool");if(Y.ceilMode!==0)throw Error("using ceil() in shape computation is not yet supported for MaxPool");let H={storageOrder:Q,dilations:X,...Y,cacheKey:""};return{...H,cacheKey:BG(H)}},jV=(J)=>{let Q=J.format;return{format:Q,...CX,cacheKey:Q}},FV=(J,Q)=>{w2(J.inputs),J.compute(IX("GlobalMaxPool",J.inputs[0],!0,Q))}}),mD=J0(()=>{A0(),Z0(),J1(),C0(),LG=(J,Q)=>{if(J.length<2||J.length>3)throw Error("DequantizeLinear requires 2 or 3 inputs.");if(J.length===3&&J[1].dims===J[2].dims)throw Error("x-scale and x-zero-point must have the same shape.");if(J.length===3&&J[0].dataType!==J[2].dataType)throw Error("x and x-zero-point must have the same data type.");if(J[0].dataType===6&&J.length>2)throw Error("In the case of dequantizing int32 there is no zero point.");if(J[1].dims.length!==0&&J[1].dims.length!==1&&J[1].dims.length!==J[0].dims.length)throw Error("scale input must be a scalar, a 1D tensor, or have the same rank as the input tensor.");if(J.length>2){if(J[0].dataType!==J[2].dataType)throw Error("x and x-zero-point must have the same data type.");if(J[1].dims.length!==J[2].dims.length)throw Error("scale and zero-point inputs must have the same rank.");if(!J[1].dims.map((X,Y)=>X===J[2].dims[Y]).reduce((X,Y)=>X&&Y,!0))throw Error("scale and zero-point inputs must have the same shape.")}if(Q.blockSize>0){if(J[1].dims.length===0||J[1].dims.length===1&&J[1].dims[0]===1)throw Error("blockSize must be set only for block quantization.");if(!J[1].dims.map((H,W)=>W===Q.axis||H===J[0].dims[W]).reduce((H,W)=>H&&W,!0))throw Error("For block qunatization, scale input shape to match the input shape except for the axis");if(J[1].dims.length!==J[0].dims.length)throw Error("For block qunatization the scale input rank must be the same as the x rank.");let X=J[0].dims[Q.axis],Y=J[1].dims[Q.axis];if(Q.blockSize<Math.ceil(X/Y)||Q.blockSize>Math.ceil(X/(Y-1)-1))throw Error("blockSize must be with in the range [ceil(dI / Si), ceil(dI / (Si - 1) - 1)].")}},UG=(J,Q)=>{let X=d.normalizeAxis(Q.axis,J[0].dims.length),Y=J[0].dataType,H=Y===3,W=J[0].dims,G=J[1].dataType,j=d.size(W),N=Y===3||Y===2,V=N?[Math.ceil(d.size(J[0].dims)/4)]:J[0].dims,L=J[1].dims,B=J.length>2?J[2]:void 0,U=B?N?[Math.ceil(d.size(B.dims)/4)]:B.dims:void 0,E=L.length===0||L.length===1&&L[0]===1,R=E===!1&&L.length===1,A=t0(j),P=E&&(!N||A===4),z=P?A:1,D=P&&!N?A:1,S=a("input",N?12:Y,V.length,D),w=a("scale",G,L.length),k=B?a("zero_point",N?12:Y,U.length):void 0,I=M0("output",G,W.length,z),C=[S,w];k&&C.push(k);let T=[V,L];B&&T.push(U);let g=[{type:12,data:j/z},{type:12,data:X},{type:12,data:Q.blockSize},...O0(...T,W)],m=(l)=>{let t=[{name:"output_size",type:"u32"},{name:"axis",type:"u32"},{name:"block_size",type:"u32"}];return`
      ${l.registerUniforms(t).declareVariables(...C,I)}
      ${l.mainStart()}
          ${l.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let output_indices = ${I.offsetToIndices("global_idx")};

          // Set input x
          ${N?`
            let input = ${S.getByOffset("global_idx / 4")};
            let x_vec = ${H?"unpack4xI8(input)":"unpack4xU8(input)"};
            let x_value = ${z===1?"x_vec[global_idx % 4]":"x_vec"};`:`let x_value = ${S.getByOffset("global_idx")};`};

          // Set scale input
          ${E?`let scale_value= ${w.getByOffset("0")}`:R?`
            let scale_index = ${I.indicesGet("output_indices","uniforms.axis")};
            let scale_value= ${w.getByOffset("scale_index")};`:`
            var scale_indices: ${w.type.indices} = output_indices;
            let index = ${w.indicesGet("scale_indices","uniforms.axis")} / uniforms.block_size;
            ${w.indicesSet("scale_indices","uniforms.axis","index")};
            let scale_value= ${w.getByIndices("scale_indices")};`};

          // Set zero-point input
          ${k?E?N?`
                let zero_point_input = ${k.getByOffset("0")};
                let zero_point_vec =  ${H?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value= zero_point_vec[0]`:`let zero_point_value = ${k.getByOffset("0")}`:R?N?`
                let zero_point_index = ${I.indicesGet("output_indices","uniforms.axis")};
                let zero_point_input = ${k.getByOffset("zero_point_index / 4")};
                let zero_point_vec =  ${H?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_index % 4]`:`
                let zero_point_index = ${I.indicesGet("output_indices","uniforms.axis")};
                let zero_point_value = ${k.getByOffset("zero_point_index")};`:N?`
                let zero_point_offset = ${w.indicesToOffset("scale_indices")};
                let zero_point_input = ${k.getByOffset("zero_point_offset / 4")};
                let zero_point_vec = ${H?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_offset % 4];`:`let zero_point_value = ${k.getByIndices("scale_indices")};`:`let zero_point_value = ${N?H?"i32":"u32":S.type.value}(0);`};
      // Compute and write output
      ${I.setByOffset("global_idx",`${I.type.value}(x_value - zero_point_value) * scale_value`)};
      }`};return{name:"DequantizeLinear",shaderCache:{hint:Q.cacheKey,inputDependencies:k?["rank","rank","rank"]:["rank","rank"]},getShaderSource:m,getRunData:()=>({outputs:[{dims:W,dataType:G}],dispatchGroup:{x:Math.ceil(j/z/64),y:1,z:1},programUniforms:g})}},NV=(J,Q)=>{LG(J.inputs,Q),J.compute(UG(J.inputs,Q))},VV=(J)=>c0({axis:J.axis,blockSize:J.blockSize})}),pD=J0(()=>{q6(),A0(),C0(),OG=(J,Q,X)=>{let Y=J===Q,H=J<Q&&X<0,W=J>Q&&X>0;if(Y||H||W)throw Error("Range these inputs' contents are invalid.")},RG=(J,Q,X,Y)=>{let H=Math.abs(Math.ceil((Q-J)/X)),W=[H],G=H,j=[{type:12,data:G},{type:Y,data:J},{type:Y,data:X},...O0(W)],N=(V)=>{let L=M0("output",Y,W.length),B=L.type.value,U=[{name:"outputSize",type:"u32"},{name:"start",type:B},{name:"delta",type:B}];return`
        ${V.registerUniforms(U).declareVariables(L)}
        ${V.mainStart()}
        ${V.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        output[global_idx] = uniforms.start + ${B}(global_idx) * uniforms.delta;
      }`};return{name:"Range",shaderCache:{hint:`${Y}`},getShaderSource:N,getRunData:()=>({outputs:[{dims:W,dataType:Y}],dispatchGroup:{x:Math.ceil(G/64)},programUniforms:j})}},KV=(J)=>{let Q=0,X=0,Y=0;J.inputs[0].dataType===6?(Q=J.inputs[0].getInt32Array()[0],X=J.inputs[1].getInt32Array()[0],Y=J.inputs[2].getInt32Array()[0]):J.inputs[0].dataType===1&&(Q=J.inputs[0].getFloat32Array()[0],X=J.inputs[1].getFloat32Array()[0],Y=J.inputs[2].getFloat32Array()[0]),a0.webgpu.validateInputContent&&OG(Q,X,Y),J.compute(RG(Q,X,Y,J.inputs[0].dataType),{inputs:[]})}}),cD=J0(()=>{A0(),Z0(),J1(),C0(),EG=(J,Q,X,Y)=>{if(J!=="none"&&Y!=="i32"&&Y!=="u32"&&Y!=="f32")throw Error(`Input ${Y} is not supported with reduction ${J}.`);let H=`{
                var oldValue = 0;
                loop {
                  let newValueF32 =`,W=`;
                  let newValue = bitcast<i32>(newValueF32);
                  let res = atomicCompareExchangeWeak(&${Q}, oldValue, newValue);
                  if res.exchanged {
                    break;
                  }
                  oldValue = res.old_value;
                }
              }`;switch(J){case"none":return`${Q}=${X};`;case"add":return Y==="i32"||Y==="u32"?`atomicAdd(&${Q}, bitcast<${Y}>(${X}));`:`
              ${H}bitcast<${Y}>(oldValue) + (${X})${W}`;case"max":return Y==="i32"||Y==="u32"?`atomicMax(&${Q}, bitcast<${Y}>(${X}));`:`
                ${H}max(bitcast<f32>(oldValue), (${X}))${W}`;case"min":return Y==="i32"||Y==="u32"?`atomicMin(&${Q}, bitcast<${Y}>(${X}));`:`${H}min(bitcast<${Y}>(oldValue), (${X}))${W}`;case"mul":return`${H}(bitcast<${Y}>(oldValue) * (${X}))${W}`;default:throw Error(`Reduction ${J} is not supported.`)}},DG=(J,Q)=>{let X=J[0].dims,Y=J[1].dims,H=X,W=1,G=Math.ceil(d.size(Y)/W),j=Y[Y.length-1],N=d.sizeFromDimension(X,j),V=[{type:12,data:G},{type:12,data:j},{type:12,data:N},...O0(J[1].dims,J[2].dims,H)],L=(B)=>{let U=a("indices",J[1].dataType,J[1].dims.length),E=a("updates",J[2].dataType,J[2].dims.length,W),R=Q.reduction!=="none"&&Q.reduction!==""?dj("output",J[0].dataType,H.length):M0("output",J[0].dataType,H.length,W);return`
      ${B.registerUniform("output_size","u32").registerUniform("last_index_dimension","u32").registerUniform("num_updates_elements","u32").declareVariables(U,E,R)}
      ${B.mainStart()}
        ${B.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
  var hasDuplicates = false;
  if (${Q.reduction==="none"}) {
    let n = ${d.size(Y)};
    for (var i = 0; i < n; i = i + 1) {
      for (var j = i + 1; j < n; j = j + 1) {
        var index_i = i32(indices[i].x);
        var index_j = i32(indices[j].x);
        if (index_i == index_j) {
          hasDuplicates = true;
          break;
        }
      }
      if (hasDuplicates) {
        break;
      }
    }
  }

  var data_offset = 0u;
  var indices_start = uniforms.last_index_dimension * global_idx;
  if (${Q.reduction==="none"} && hasDuplicates) {
    if (global_idx != 0u) {
      return;
    }
    indices_start = 0u;
  }
  let indices_end = indices_start + uniforms.last_index_dimension;
  for (var i = indices_start; i < indices_end; i++) {
    var index = i32(indices[i].x);
    ${J[0].dims.length===1?`
    let element_count_dim = uniforms.output_strides;
    let dim_value = uniforms.output_shape;`:`
    let element_count_dim = uniforms.output_strides[i - indices_start];
    let dim_value = uniforms.output_shape[i - indices_start + uniforms.last_index_dimension];`}
    if (index >= 0) {
      if (index >= i32(dim_value)) {
        index = i32(dim_value - 1);
      }
    } else {
      if (index < -i32(dim_value)) {
        index = 0;
      } else {
        index += i32(dim_value);
      }
    }
    data_offset += u32((u32(index) * element_count_dim));
  }

  for (var i = 0u; i < uniforms.num_updates_elements; i++) {
    let value = updates[uniforms.num_updates_elements * global_idx + i];
    ${EG(Q.reduction,"output[data_offset + i]","value",R.type.value)}
  }

      }`};return{name:"ScatterND",shaderCache:{hint:`${Q.cacheKey}_${Q.reduction}`,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:H,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(G/64)},programUniforms:V}),getShaderSource:L}},MV=(J)=>c0({reduction:J.reduction}),BV=(J,Q)=>{J.compute(DG(J.inputs,Q),{inputs:[J.inputs[1],J.inputs[2]],outputs:[]})}}),dD=J0(()=>{A0(),Z0(),J1(),C0(),AG=(J,Q)=>{if(J.every((X)=>X>0||(()=>{throw Error("Resize requires scales input values to be positive")})),J.length>0){if(Q.mode==="linear"){if(!(J.length===2||J.length===3||J.length===4&&J[0]===1&&J[1]===1||J.length===4&&J[0]===1&&J[3]===1||J.length===5&&J[0]===1&&J[1]===1))throw Error(`For linear mode, Resize requires scales to be 2D, 3D, 4D with either two outermost or one innermost and
            one outermost scale values equal to 1, or 5D with two outermost scale values equal to 1`)}else if(Q.mode==="cubic"&&!(J.length===2||J.length===4&&J[0]===1&&J[1]===1||J.length===4&&J[0]===1&&J[3]===1))throw Error("Resize requires scales input size to be 2 or 4 for cubic mode")}},zG=(J,Q,X)=>{Q.every((H)=>H>=0&&H<X||(()=>{throw Error("Resize requires axes input values to be positive and less than rank")}));let Y=Array(X).fill(1);return Q.forEach((H,W)=>Y[H]=J[W]),Y},$G=(J,Q,X,Y,H,W)=>{let[G,j,N]=X>10?[1,2,3]:[-1,J.length>1?1:-1,-1],V=J[0].dims.length;if(G>0&&J.length>G&&J[G].dims.length>0)J[G].getFloat32Array().forEach((L)=>W.push(L));else if(Q.coordinateTransformMode==="tf_crop_and_resize")throw Error("Resize requires RoI input to be specified when coordinateTransformMode is tfCropAndResize");if(j>0&&J.length>j&&J[j].dims.length===1&&J[j].dims[0]>0){if(J[j].getFloat32Array().forEach((L)=>Y.push(L)),Y.length!==0&&Y.length!==V&&X>=18&&Y.length!==Q.axes.length)throw Error("Resize requires scales input size to be same as input rank or axes size for opset 18 and up");AG(Y,Q),Q.axes.length>0&&zG(Y,Q.axes,V).forEach((L,B)=>Y[B]=L)}if(N>0&&J.length>N&&J[N].dims.length===1&&J[N].dims[0]>0&&(J[N].getBigInt64Array().forEach((L)=>H.push(Number(L))),H.length!==0&&H.length!==V&&X>=18&&H.length!==Q.axes.length))throw Error("Resize requires sizes input size to be same as input rank or axes size for opset 18 and up");if(Q.axes.length>0){if(Y.length!==0&&Y.length!==Q.axes.length)throw Error('Resize requires "scales" input size to be of axes rank when axes attributes is specified');if(H.length!==0&&H.length!==Q.axes.length)throw Error('Resize requires "sizes" input size to be of rank axes rank when axes attributes is specified')}if(typeof Y<"u"&&typeof H<"u"&&Y.length>0&&H.length>V)throw Error("Resize requires only of scales or sizes to be specified")},_X=(J,Q,X,Y)=>`
  // The whole part and the fractional part are calculated separately due to inaccuracy of floating
  // point division. As an example, f32(21) / f32(7) may evaluate to 2.99... instead of 3, causing an
  // offset-by-one error later in floor().
  let big = (${J}) * (${Q});
  let whole = ${Y}(big / (${X}));
  let fract = ${Y}(big % (${X})) / ${Y}(${X});
  return whole + fract;
`,PG=(J,Q)=>`fn getOriginalCoordinateFromResizedCoordinate(xResized: u32, xScale: f32, lengthResized: u32,
     lengthOriginal: u32, roiStart: f32, roiEnd: f32) -> ${Q} { `+(()=>{switch(J){case"asymmetric":return`
          if (xScale < 1.0 || floor(xScale) != xScale) {
            return ${Q}(xResized) / ${Q}(xScale);
          } else {
            ${_X("xResized","lengthOriginal","lengthResized",Q)}
          }
        `;case"pytorch_half_pixel":return`if (lengthResized > 1) {
                    return (${Q}(xResized) + 0.5) / ${Q}(xScale) - 0.5;
                  } else {
                    return 0.0;
                  }`;case"tf_half_pixel_for_nn":return`return (${Q}(xResized) + 0.5) / ${Q}(xScale);`;case"align_corners":return`if (lengthResized == 1) {
                    return 0.0;
                  } else {
                    ${_X("xResized","lengthOriginal - 1","lengthResized - 1",Q)}
                  }`;case"tf_crop_and_resize":return`if (lengthResized > 1) {
                    return ${Q}(roiStart) * ${Q}(lengthOriginal - 1) +
                        (${Q}(xResized) * ${Q}(roiEnd - roiStart) * ${Q}(lengthOriginal - 1)) /
                        ${Q}(lengthResized - 1);
                  } else {
                    return 0.5 * ${Q}(roiStart + roiEnd) * ${Q}(lengthOriginal - 1);
                  }`;case"half_pixel_symmetric":return`const outputWidth = ${Q}xScale * ${Q}(lengthResized);
                  const adjustment = ${Q}(lengthResized) / outputWidth;
                  const center = ${Q}(lengthOriginal) / 2;
                  const offset = center * (1 - adjustment);
                  return offset + ((${Q}(xResized) + 0.5) / ${Q}(xScale)) - 0.5;`;case"half_pixel":return`return ((${Q}(xResized) + 0.5) / ${Q}(xScale)) - 0.5;`;default:throw Error(`Coordinate transform mode ${J} is not supported`)}})()+"}",SG=(J,Q,X)=>`fn getNearestPixelFromOriginal(xOriginal: ${X}, isDownSample: bool) -> ${X} {`+(()=>{switch(J){case"round_prefer_ceil":return"if (fract(xOriginal) == 0.5) {             return ceil(xOriginal);           } else {             return round(xOriginal);           }";case"floor":return"return floor(xOriginal);";case"ceil":return"return ceil(xOriginal);";case"round_prefer_floor":return"if (fract(xOriginal) == 0.5) {                     return floor(xOriginal);                   } else {                     return round(xOriginal);                   }";case"simple":default:if(Q<11)return"if (isDownSample)                     {                       return ceil(xOriginal);                     } else {                       return xOriginal;                     }";throw Error(`Nearest mode ${J} is not supported`)}})()+"}",ZG=(J,Q,X)=>{let Y=Array(X).fill(0).concat(Array(X).fill(1)),H=J.length===0?Y:J.slice();return Q.length>0?(Q.forEach((W,G)=>{Y[W]=H[G],Y[G+X]=H[Q.length+G]}),Y):H},wG=(J,Q,X,Y)=>{let H=[];if(X.length>0)if(Y.length>0){if(J.forEach((W)=>H.push(W)),Math.max(...Y)>J.length)throw Error("axes is out of bound");Y.forEach((W,G)=>H[W]=X[G])}else X.forEach((W)=>H.push(W));else{if(Q.length===0)throw Error("Resize requires either scales or sizes.");H=J.map((W,G)=>Math.round(W*Q[G]))}return H},kG=(J,Q,X)=>{let Y=(()=>{switch(X.keepAspectRatioPolicy){case"not_larger":return X.axes.length>0?Math.min(...X.axes.map((W)=>Q[W]),Number.MAX_VALUE):Math.min(...Q,Number.MAX_VALUE);case"not_smaller":return X.axes.length>0?Math.max(...X.axes.map((W)=>Q[W]),Number.MIN_VALUE):Math.max(...Q,Number.MIN_VALUE);default:throw Error(`Keep aspect ratio policy ${X.keepAspectRatioPolicy} is not supported`)}})();Q.fill(1,0,Q.length);let H=J.slice();return X.axes.length>0?(X.axes.forEach((W)=>Q[W]=Y),X.axes.forEach((W)=>H[W]=Math.round(J[W]*Q[W]))):(Q.fill(Y,0,Q.length),H.forEach((W,G)=>H[G]=Math.round(W*Q[G]))),H},CG=(J,Q,X,Y,H)=>`
    fn calculateOriginalIndicesFromOutputIndices(output_indices: ${J.type.indices}) -> array<${J.type.value}, ${X.length}> {
      var original_indices: array<${J.type.value}, ${X.length}>;
      for (var i:u32 = 0; i < ${X.length}; i++) {
        var output_index = ${J.indicesGet("output_indices","i")};
        var scale = ${L0("uniforms.scales","i",Y)};
        var roi_low = ${L0("uniforms.roi","i",H)};
        var roi_hi = ${L0("uniforms.roi",`i + ${Q.length}`,H)};
        if (scale == 1.0) {
          original_indices[i] = ${J.type.value}(output_index);
        } else {
          var input_shape_i = ${L0("uniforms.input_shape","i",Q.length)};
          var output_shape_i = ${L0("uniforms.output_shape","i",X.length)};
          original_indices[i] = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                           input_shape_i, roi_low, roi_hi);
        }
      }
      return original_indices;
    }`,IG=(J,Q,X,Y,H,W,G)=>`
    fn calculateInputIndicesFromOutputIndices(output_indices: ${Q.type.indices}) -> ${J.type.indices} {
      var input_indices: ${J.type.indices};
      for (var i:u32 = 0; i < ${Y.length}; i++) {
        var output_index = ${Q.indicesGet("output_indices","i")};
        var input_index: u32;
        var scale = ${L0("uniforms.scales","i",H)};
        if (scale == 1.0) {
          input_index = output_index;
        } else {
          var roi_low = ${L0("uniforms.roi","i",W)};
          var roi_hi = ${L0("uniforms.roi",`i + ${X.length}`,W)};
          var input_shape_i = ${L0("uniforms.input_shape","i",X.length)};
          var output_shape_i = ${L0("uniforms.output_shape","i",Y.length)};
          var original_idx = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                        input_shape_i, roi_low, roi_hi);
          if (!${G} || (original_idx >= 0 && original_idx < ${Q.type.value}(input_shape_i))) {
            if (original_idx < 0) {
              input_index = 0;
            } else if (original_idx > ${Q.type.value}(input_shape_i - 1)) {
              input_index = input_shape_i - 1;
            } else {
              input_index = u32(getNearestPixelFromOriginal(original_idx, scale < 1));
            }
          } else {
            input_index = u32(original_idx);
          }
        }
        ${J.indicesSet("input_indices","i","input_index")}
      }
      return input_indices;
    }`,_G=(J,Q)=>`
    fn checkInputIndices(input_indices: ${J.type.indices}) -> bool {
      for (var i:u32 = 0; i < ${Q.length}; i++) {
        var input_index = ${J.indicesGet("input_indices","i")};
        if (input_index < 0 || input_index >= ${L0("uniforms.input_shape","i",Q.length)}) {
          return false;
        }
      }
      return true;
    }`,bX=(J,Q,X,Y)=>J.rank>Y?`
    ${J.indicesSet("input_indices",Q,"channel")};
    ${J.indicesSet("input_indices",X,"batch")};
`:"",bG=(J,Q,X,Y,H)=>{let[W,G,j,N]=X.length===2?[-1,0,1,-1]:[0,2,3,1],V=J.type.value;return`
    fn getInputValue(batch: u32, channel: u32, row: u32, col: u32) -> ${V} {
      var input_indices: ${J.type.indices};
      ${J.indicesSet("input_indices",G,`max(0, min(row, ${X[G]} - 1))`)};
      ${J.indicesSet("input_indices",j,`max(0, min(col, ${X[j]} - 1))`)};
      ${bX(J,N,W,2)}
      return ${J.getByIndices("input_indices")};
    }

    fn bilinearInterpolation(output_indices: ${Q.type.indices}) -> ${V} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var row:${V} = originalIndices[${G}];
      var col:${V} = originalIndices[${j}];
      ${Y?`if (row < 0 || row > (${X[G]} - 1) || col < 0 || col > (${X[j]} - 1)) {
        return ${H};
      }`:""};
      row = max(0, min(row, ${X[G]} - 1));
      col = max(0, min(col, ${X[j]} - 1));
      var row1: u32 = u32(row);
      var col1: u32 = u32(col);
      var row2: u32 = u32(row + 1);
      var col2: u32 = u32(col + 1);
      var channel: u32 = ${X.length>2?`u32(originalIndices[${N}])`:"0"};
      var batch: u32 =  ${X.length>2?`u32(originalIndices[${W}])`:"0"};
      var x11: ${V} = getInputValue(batch, channel, row1, col1);
      var x12: ${V} = getInputValue(batch, channel, row1, col2);
      var x21: ${V} = getInputValue(batch, channel, row2, col1);
      var x22: ${V} = getInputValue(batch, channel, row2, col2);
      var dx1: ${V} = abs(row - ${V}(row1));
      var dx2: ${V} = abs(${V}(row2) - row);
      var dy1: ${V} = abs(col - ${V}(col1));
      var dy2: ${V} = abs(${V}(col2) - col);
      if (row1 == row2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (col1 == col2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      return (x11 * dx2 * dy2 + x12 * dx2 * dy1 + x21 * dx1 * dy2 + x22 * dx1 * dy1);
    }`},vG=(J,Q,X,Y,H,W,G,j,N,V)=>{let L=X.length===2,B=!0,[U,E]=L?[0,1]:B?[2,3]:[1,2],R=J.type.value,A=(P)=>{let z=P===U?"row":"col";return`
      fn ${z}CubicInterpolation(input_indices: ${J.type.indices}, output_indices: ${Q.type.indices}) -> ${R} {
        var output_index = ${Q.indicesGet("output_indices",P)};
        var originalIdx: ${R} = getOriginalCoordinateFromResizedCoordinate(output_index, ${H[P]},
        ${Y[P]}, ${X[P]}, ${W[P]}, ${W[P]} + ${X.length});
        var fractOriginalIdx: ${R} = originalIdx - floor(originalIdx);
        var coefs = getCubicInterpolationCoefs(fractOriginalIdx);

        if (${j} && (originalIdx < 0 || originalIdx > (${X[P]} - 1))) {
          return ${N};
        }
        var data: array<${R}, 4> = array<${R}, 4>(0.0, 0.0, 0.0, 0.0);
        for (var i: i32 = -1; i < 3; i++) {
          var ${z}: ${R} = originalIdx + ${R}(i);
          if (${z} < 0 || ${z} >= ${X[P]}) {
            ${V?`coefs[i + 1] = 0.0;
                        continue;`:j?`return ${N};`:`${z} = max(0, min(${z}, ${X[P]} - 1));`};
          }
        var input_indices_copy: ${J.type.indices} = input_indices;
          ${J.indicesSet("input_indices_copy",P,`u32(${z})`)};
          data[i + 1] = ${P===U?J.getByIndices("input_indices_copy"):"rowCubicInterpolation(input_indices_copy, output_indices)"};
        }
        return cubicInterpolation1D(data, coefs);
      }`};return`
    ${A(U)};
    ${A(E)};
  fn getCubicInterpolationCoefs(s: ${R}) -> array<${R}, 4> {
    var absS = abs(s);
    var coeffs: array<${R}, 4> = array<${R}, 4>(0.0, 0.0, 0.0, 0.0);
    var oneMinusAbsS: ${R} = 1.0 - absS;
    var twoMinusAbsS: ${R} = 2.0 - absS;
    var onePlusAbsS: ${R} = 1.0 + absS;
    coeffs[0] = ((${G} * onePlusAbsS - 5 * ${G}) * onePlusAbsS + 8 * ${G}) * onePlusAbsS - 4 * ${G};
    coeffs[1] = ((${G} + 2) * absS - (${G} + 3)) * absS * absS + 1;
    coeffs[2] = ((${G} + 2) * oneMinusAbsS - (${G} + 3)) * oneMinusAbsS * oneMinusAbsS + 1;
    coeffs[3] = ((${G} * twoMinusAbsS - 5 * ${G}) * twoMinusAbsS + 8 * ${G}) * twoMinusAbsS - 4 * ${G};
    return coeffs;
  }

  fn cubicInterpolation1D(x: array<${R}, 4>, coefs: array<${R}, 4>) -> ${R} {
    var coefsSum: ${R} = coefs[0] + coefs[1] + coefs[2] + coefs[3];
    return (x[0] * coefs[0] + x[1] * coefs[1]+ x[2] * coefs[2]+ x[3] * coefs[3]) / coefsSum;
  }

  fn bicubicInterpolation(output_indices: ${Q.type.indices}) -> ${R} {
    var input_indices: ${J.type.indices} = output_indices;
    return colCubicInterpolation(input_indices, output_indices);
  }
    `},TG=(J,Q,X,Y,H)=>{let[W,G,j,N,V]=X.length===3?[-1,0,1,2,-1]:[0,2,3,4,1],L=J.type.value;return`
    fn getInputValue(batch: u32, channel: u32, depth:u32, height: u32, width: u32) -> ${L} {
      var input_indices: ${J.type.indices};
      ${J.indicesSet("input_indices",G,`max(0, min(depth, ${X[G]} - 1))`)};
      ${J.indicesSet("input_indices",j,`max(0, min(height, ${X[j]} - 1))`)};
      ${J.indicesSet("input_indices",N,`max(0, min(width, ${X[N]} - 1))`)};
      ${bX(J,V,W,3)}
      return ${J.getByIndices("input_indices")};
    }

    fn trilinearInterpolation(output_indices: ${Q.type.indices}) -> ${L} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var depth:${L} = originalIndices[${G}];
      var height:${L} = originalIndices[${j}];
      var width:${L} = originalIndices[${N}];
      ${Y?`if (depth < 0 || depth > (${X[G]} - 1) || height < 0 || height > (${X[j]} - 1) || width < 0 || (width > ${X[N]} - 1)) {
      return ${H};
        }`:""};

    depth = max(0, min(depth, ${X[G]} - 1));
      height = max(0, min(height, ${X[j]} - 1));
      width = max(0, min(width, ${X[N]} - 1));
      var depth1: u32 = u32(depth);
      var height1: u32 = u32(height);
      var width1: u32 = u32(width);
      var depth2: u32 = u32(depth + 1);
      var height2: u32 = u32(height + 1);
      var width2: u32 = u32(width + 1);
      var channel: u32 = ${X.length>3?`u32(originalIndices[${V}])`:"0"};
      var batch: u32 =  ${X.length>3?`u32(originalIndices[${W}])`:"0"};

      var x111: ${L} = getInputValue(batch, channel, depth1, height1, width1);
      var x112: ${L} = getInputValue(batch, channel, depth1, height1, width2);
      var x121: ${L} = getInputValue(batch, channel, depth1, height2, width1);
      var x122: ${L} = getInputValue(batch, channel, depth1, height2, width2);
      var x211: ${L} = getInputValue(batch, channel, depth2, height1, width1);
      var x212: ${L} = getInputValue(batch, channel, depth2, height1, width2);
      var x221: ${L} = getInputValue(batch, channel, depth2, height2, width1);
      var x222: ${L} = getInputValue(batch, channel, depth2, height2, width2);
      var dx1: ${L} = abs(depth - ${L}(depth1));
      var dx2: ${L} = abs(${L}(depth2) - depth);
      var dy1: ${L} = abs(height - ${L}(height1));
      var dy2: ${L} = abs(${L}(height2) - height);
      var dz1: ${L} = abs(width - ${L}(width1));
      var dz2: ${L} = abs(${L}(width2) - width);
      if (depth1 == depth2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (height1 == height2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      if (width1 == width2) {
        dz1 = 0.5;
        dz2 = 0.5;
      }
      return (x111 * dx2 * dy2 * dz2 + x112 * dx2 * dy2 * dz1 + x121 * dx2 * dy1 *dz2 + x122 * dx2 * dy1 * dz1 +
              x211 * dx1 * dy2 * dz2 + x212 * dx1 * dy2 * dz1 + x221 * dx1 * dy1 *dz2 + x222 * dx1 * dy1 * dz1);
    }`},xG=(J,Q,X,Y,H,W)=>{let G=J.dims,j=ZG(W,Q.axes,G.length),N=wG(G,Y,H,Q.axes),V=Y.slice();Y.length===0&&(V=G.map((D,S)=>D===0?1:N[S]/D),Q.keepAspectRatioPolicy!=="stretch"&&(N=kG(G,V,Q)));let L=M0("output",J.dataType,N.length),B=a("input",J.dataType,G.length),U=d.size(N),E=G.length===N.length&&G.every((D,S)=>D===N[S]),R=Q.coordinateTransformMode==="tf_crop_and_resize",A=Q.extrapolationValue,P=B.type.value,z=(D)=>`
      ${E?"":`
      ${PG(Q.coordinateTransformMode,P)};
      ${(()=>{switch(Q.mode){case"nearest":return`
              ${_G(B,G)};
              ${SG(Q.nearestMode,X,P)};
              ${IG(B,L,G,N,V.length,j.length,R)};
              `;case"linear":return`
              ${CG(L,G,N,V.length,j.length)};
              ${(()=>{if(G.length===2||G.length===4)return`${bG(B,L,G,R,A)}`;if(G.length===3||G.length===5)return`${TG(B,L,G,R,A)}`;throw Error("Linear mode only supports input dims 2, 3, 4 and 5 are supported in linear mode.")})()};
            `;case"cubic":return`
            ${(()=>{if(G.length===2||G.length===4)return`${vG(B,L,G,N,V,j,Q.cubicCoeffA,R,Q.extrapolationValue,Q.excludeOutside)}`;throw Error("Cubic mode only supports input dims 2 and 4 are supported in linear mode.")})()};
            `;default:throw Error("Invalid resize mode")}})()};
      `}
      ${D.registerUniform("output_size","u32").registerUniform("scales","f32",V.length).registerUniform("roi","f32",j.length).declareVariables(B,L)}
      ${D.mainStart()}
        ${D.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
        ${E?"output[global_idx] = input[global_idx];":`
        let output_indices = ${L.offsetToIndices("global_idx")};
        var input_indices: ${B.type.indices};
        ${(()=>{switch(Q.mode){case"nearest":return`input_indices = calculateInputIndicesFromOutputIndices(output_indices);
                if (checkInputIndices(input_indices)) {
                  output[global_idx] = ${B.getByIndices("input_indices")};
                } else {
                  output[global_idx] = ${Q.extrapolationValue};
                }`;case"linear":return`output[global_idx] = ${G.length===2||G.length===4?"bilinearInterpolation":"trilinearInterpolation"}(output_indices);`;case"cubic":return"output[global_idx] = bicubicInterpolation(output_indices);";default:throw Error(`Unsupported resize mode: ${Q.mode}`)}})()};
`}
      }`;return{name:"Resize",shaderCache:{hint:`${Q.cacheKey}|${X}|${V.length>0?Q.mode==="cubic"?V:V.length:""}|${H.length>0?H:""}|${j.length>0?j:""}|${E}|${Q.mode==="nearest"?G.length:G}`,inputDependencies:["rank"]},getShaderSource:z,getRunData:()=>({outputs:[{dims:N,dataType:J.dataType}],dispatchGroup:{x:Math.ceil(U/64)},programUniforms:[{type:12,data:U},{type:1,data:V},{type:1,data:j},...O0(G,N)]})}},fG=(J)=>{let Q=J.customDataBuffer;return new Uint32Array(Q,Q.byteOffset,1)[0]},LV=(J,Q)=>{let X=[],Y=[],H=[],W=fG(J);if(Q.antialias!==0)throw Error("Only default value (0) for Antialias attribute is supported");$G(J.inputs,Q,W,X,Y,H),J.compute(xG(J.inputs[0],Q,W,X,Y,H),{inputs:[0]})},UV=(J)=>{let{antialias:Q,axes:X,coordinateTransformMode:Y,cubicCoeffA:H}=J,W=J.excludeOutside!==0,G=J.extrapolationValue,j=J.keepAspectRatioPolicy,N=J.mode,V=J.nearestMode===""?"simple":J.nearestMode;return c0({antialias:Q,axes:X,coordinateTransformMode:Y,cubicCoeffA:H,excludeOutside:W,extrapolationValue:G,keepAspectRatioPolicy:j,mode:N,nearestMode:V})}}),uD=J0(()=>{A0(),Z0(),J1(),C0(),hG=(J,Q)=>{let[X,Y,H,W]=J,{numHeads:G,rotaryEmbeddingDim:j}=Q;if(X.dims.length!==3&&X.dims.length!==4)throw Error(`Input 'x' is expected to have 3 or 4 dimensions, got ${X.dims.length}`);if(!d.areEqual(Y.dims,[])&&!d.areEqual(Y.dims,[1])&&Y.dims.length!==2)throw Error(`Input 'position_ids' is expected to have 0, 1, or 2 dimensions, got ${Y.dims.length}`);if(H.dims.length!==2)throw Error(`Input 'cos_cache' is expected to have 2 dimensions, got ${H.dims.length}`);if(W.dims.length!==2)throw Error(`Input 'sin_cache' is expected to have 2 dimensions, got ${W.dims.length}`);if(!d.areEqual(H.dims,W.dims))throw Error("Inputs 'cos_cache' and 'sin_cache' are expected to have the same shape");if(j>0&&G===0)throw Error("num_heads must be provided if rotary_embedding_dim is specified");let N=X.dims[0],V=X.dims[X.dims.length-2],L=H.dims[0],B=d.sizeFromDimension(X.dims,1)/V,U=j===0?H.dims[1]*2:B/G;if(j>U)throw Error("rotary_embedding_dim must be less than or equal to head_size");if(Y.dims.length===2){if(N!==Y.dims[0])throw Error(`Input 'position_ids' dimension 0 should be of size batch_size, got ${Y.dims[0]}`);if(V!==Y.dims[1])throw Error(`Input 'position_ids' dimension 1 should be of size sequence_length, got ${Y.dims[1]}`)}if(U/2!==H.dims[1]&&j/2!==H.dims[1])throw Error(`Input 'cos_cache' dimension 1 should be same as head_size / 2 or rotary_embedding_dim / 2, got ${H.dims[1]}`);if(V>L)throw Error("Updating cos_cache and sin_cache in RotaryEmbedding is not currently supported")},yG=(J,Q)=>{let{interleaved:X,numHeads:Y,rotaryEmbeddingDim:H,scale:W}=Q,G=J[0].dims[0],j=d.sizeFromDimension(J[0].dims,1),N=J[0].dims[J[0].dims.length-2],V=j/N,L=J[2].dims[1],B=H===0?L*2:V/Y,U=[G,N,V/B,B-L],E=d.computeStrides(U),R=[{type:1,data:W},{type:12,data:U},{type:12,data:E},...J[0].dims.length===3?[{type:12,data:[j,V,B,1]}]:[],...J[0].dims.length===4?[{type:12,data:[j,B,N*B,1]}]:[],...O0(J[0].dims,J[1].dims,J[2].dims,J[3].dims,J[0].dims)],A=(P)=>{let z=a("input",J[0].dataType,J[0].dims.length),D=a("position_ids",J[1].dataType,J[1].dims.length),S=a("cos_cache",J[2].dataType,J[2].dims.length),w=a("sin_cache",J[3].dataType,J[3].dims.length),k=M0("output",J[0].dataType,J[0].dims.length);return P.registerUniforms([{name:"scale",type:"f32"},{name:"global_shape",type:"u32",length:U.length},{name:"global_strides",type:"u32",length:E.length},{name:"input_output_strides",type:"u32",length:E.length}]),`
        ${P.declareVariables(z,D,S,w,k)}

        ${P.mainStart(Q7)}
          let half_rotary_emb_dim = uniforms.${S.name}_shape[1];
          let bsnh = global_idx / uniforms.global_strides % uniforms.global_shape;
          let size = uniforms.global_shape[0] * uniforms.global_strides[0];
          ${P.guardAgainstOutOfBoundsWorkgroupSizes("size")}

          if (bsnh[3] < half_rotary_emb_dim) {
            let position_ids_idx =
                ${D.broadcastedIndicesToOffset("bsnh.xy",M0("",D.type.tensor,2))};
            let position_id =
                u32(${D.getByOffset("position_ids_idx")}) + select(0, bsnh[1], position_ids_idx == 0);
            let i = dot(bsnh, uniforms.input_output_strides) + select(0, bsnh[3], ${X});
            let j = i + select(half_rotary_emb_dim, 1, ${X});
            let re = ${z.getByOffset("i")} * ${S.get("position_id","bsnh[3]")} -
                ${z.getByOffset("j")} * ${w.get("position_id","bsnh[3]")};
            ${k.setByOffset("i","re")}
            let im = ${z.getByOffset("i")} * ${w.get("position_id","bsnh[3]")} +
                ${z.getByOffset("j")} * ${S.get("position_id","bsnh[3]")};
            ${k.setByOffset("j","im")}
          } else {
            let k = dot(bsnh, uniforms.input_output_strides) + half_rotary_emb_dim;
            ${k.setByOffset("k",z.getByOffset("k"))}
          }
        }`};return{name:"RotaryEmbedding",shaderCache:{hint:c0({interleaved:X}).cacheKey,inputDependencies:["rank","rank","rank","rank"]},getShaderSource:A,getRunData:()=>({outputs:[{dims:J[0].dims,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(d.size(U)/Q7)},programUniforms:R})}},OV=(J,Q)=>{hG(J.inputs,Q),J.compute(yG(J.inputs,Q))}}),oD=J0(()=>{A0(),Z0(),C0(),gG=(J)=>{if(!J||J.length<3)throw Error("layerNorm requires at least 3 inputs.");let Q=J[0],X=J[1],Y=J[2];if(Q.dataType!==X.dataType||Q.dataType!==Y.dataType)throw Error("All inputs must have the same data type");if(Q.dims.length!==3&&Q.dims.length!==2)throw Error("Input must be 2D or 3D");if(X.dims.length!==3&&X.dims.length!==2)throw Error("Skip must be 2D or 3D");let H=Q.dims[Q.dims.length-1],W=Q.dims[Q.dims.length-2];if(X.dims[X.dims.length-1]!==H)throw Error("Skip must have the same hidden size as input");if(X.dims[X.dims.length-2]!==W)throw Error("Skip must have the same sequence length as input");if(Y.dims.length!==1)throw Error("Gamma must be 1D");if(Y.dims[Y.dims.length-1]!==H)throw Error("Gamma must have the same hidden size as input");if(J.length>3){let G=J[3];if(G.dims.length!==1)throw Error("Beta must be 1D");if(G.dims[G.dims.length-1]!==H)throw Error("Beta must have the same hidden size as input")}if(J.length>4){let G=J[4];if(G.dims.length!==1)throw Error("Bias must be 1D");if(G.dims[G.dims.length-1]!==H)throw Error("Bias must have the same hidden size as input")}},lG=(J,Q,X,Y)=>{let H=Q.simplified,W=J[0].dims,G=d.size(W),j=W,N=G,V=W.slice(-1)[0],L=Y?W.slice(0,-1).concat(1):[],B=!H&&J.length>3,U=J.length>4,E=Y&&X>1,R=Y&&X>2,A=X>3,P=64,z=t0(V),D=[{type:12,data:N},{type:12,data:z},{type:12,data:V},{type:1,data:Q.epsilon}],S=(k)=>{let I=[{name:"output_size",type:"u32"},{name:"components",type:"u32"},{name:"hidden_size",type:"u32"},{name:"epsilon",type:"f32"}],C=[a("x",J[0].dataType,J[0].dims,z),a("skip",J[1].dataType,J[1].dims,z),a("gamma",J[2].dataType,J[2].dims,z)];B&&C.push(a("beta",J[3].dataType,J[3].dims,z)),U&&C.push(a("bias",J[4].dataType,J[4].dims,z)),C.push(M0("output",J[0].dataType,j,z)),E&&C.push(M0("mean_output",1,L)),R&&C.push(M0("inv_std_output",1,L)),A&&C.push(M0("input_skip_bias_sum",J[0].dataType,j,z));let T=N1(J[0].dataType),g=N1(1,z);return`

      ${k.registerUniforms(I).declareVariables(...C)}
      var<workgroup> sum_shared : array<${g}, ${P}>;
      var<workgroup> sum_squared_shared : array<${g}, ${P}>;

      ${k.mainStart([P,1,1])}
        let ix = local_id.x;
        let iy = global_id.x / ${P};

        let hidden_size_vectorized: u32 = uniforms.hidden_size / uniforms.components;
        var stride = hidden_size_vectorized / ${P};
        let offset = ix * stride + iy * hidden_size_vectorized;
        let offset1d = stride * ix;
        if (ix == ${P-1}) {
          stride = hidden_size_vectorized - stride * ix;
        }
        for (var i: u32 = 0; i < stride; i++) {
          let skip_value = skip[offset + i];
          let bias_value = ${U?"bias[offset1d + i]":T+"(0.0)"};
          let input_value = x[offset + i];
          let value = input_value + skip_value + bias_value;
          ${A?"input_skip_bias_sum[offset + i] = value;":""}
          output[offset + i] = value;
          let f32_value = ${e8(T,z,"value")};
          sum_shared[ix] += f32_value;
          sum_squared_shared[ix] += f32_value * f32_value;
        }
        workgroupBarrier();

        var reduce_size : u32 = ${P};
        for (var curr_size = reduce_size >> 1;  curr_size > 0; curr_size = reduce_size >> 1) {
          reduce_size = curr_size + (reduce_size & 1);
          if (ix < curr_size) {
            sum_shared[ix] += sum_shared[ix + reduce_size];
            sum_squared_shared[ix] += sum_squared_shared[ix + reduce_size];
          }
          workgroupBarrier();
        }

        let sum = sum_shared[0];
        let square_sum = sum_squared_shared[0];
        let mean = ${d6("sum",z)} / f32(uniforms.hidden_size);
        let inv_std_dev = inverseSqrt(${d6("square_sum",z)} / f32(uniforms.hidden_size) ${H?"":"- mean * mean"} + uniforms.epsilon);
        ${E?"mean_output[global_idx] = mean;":""}
        ${R?"inv_std_output[global_idx] = inv_std_dev;":""}

        for (var i: u32 = 0; i < stride; i++) {
          output[offset + i] = (output[offset + i] ${H?"":`- ${T}(mean)`}) *
            ${T}(inv_std_dev) * gamma[offset1d + i]
            ${B?"+ beta[offset1d + i]":""};
        }
      }`},w=[{dims:j,dataType:J[0].dataType}];return X>1&&w.push({dims:L,dataType:1}),X>2&&w.push({dims:L,dataType:1}),X>3&&w.push({dims:W,dataType:J[0].dataType}),{name:"SkipLayerNormalization",shaderCache:{hint:`${z};${E};${R};${A}`,inputDependencies:J.map((k,I)=>"type")},getShaderSource:S,getRunData:()=>({outputs:w,dispatchGroup:{x:Math.ceil(N/V)},programUniforms:D})}},RV=(J,Q)=>{gG(J.inputs);let X=[0];J.outputCount>1&&X.push(-3),J.outputCount>2&&X.push(-3),J.outputCount>3&&X.push(3),J.compute(lG(J.inputs,Q,J.outputCount,!1),{outputs:X})}}),sD=J0(()=>{A0(),Z0(),J1(),C0(),mG=(J,Q)=>{if(!J||J.length<1)throw Error("too few inputs");if(Q.axes.length!==0){if(Q.axes.length!==Q.starts.length||Q.axes.length!==Q.ends.length)throw Error("axes, starts and ends must have the same length")}else if(Q.starts.length!==Q.ends.length)throw Error("starts and ends must have the same length");J.slice(1).forEach((X,Y)=>{if(J[Y+1].dataType!==6&&J[Y+1].dataType!==7)throw Error(`Input ${Y} must be an array of int32 or int64`)})},k2=(J,Q)=>{let X=[];if(J.length>Q)if(J[Q].dataType===7)J[Q].getBigInt64Array().forEach((Y)=>X.push(Number(Y)));else if(J[Q].dataType===6)J[Q].getInt32Array().forEach((Y)=>X.push(Number(Y)));else throw Error(`Input ${Q} must be an array of int32 or int64`);return X},pG=(J,Q)=>{if(J.length>1){let X=k2(J,1),Y=k2(J,2),H=k2(J,3);return H.length===0&&(H=[...Array(J[0].dims.length).keys()]),c0({starts:X,ends:Y,axes:H})}else return Q},vX=(J,Q,X,Y,H)=>{let W=J;return J<0&&(W+=X[Y[Q]]),H[Q]<0?Math.max(0,Math.min(W,X[Y[Q]]-1)):Math.max(0,Math.min(W,X[Y[Q]]))},cG=(J,Q,X)=>`fn calculateInputIndices(output_indices: ${Q.type.indices}) -> ${J.type.indices} {
          var input_indices: ${J.type.indices};
          var carry = 0u;
          for (var i = ${X.length}; i >= 0; i--) {
            let input_shape_i = ${L0("uniforms.input_shape","i",X.length)};
            let steps_i = ${L0("uniforms.steps","i",X.length)};
            let signs_i = ${L0("uniforms.signs","i",X.length)};
            let starts_i = ${L0("uniforms.starts","i",X.length)};
            var output_index = ${Q.indicesGet("output_indices","i")};
            var input_index = output_index * steps_i + starts_i + carry;
            carry = input_index / input_shape_i;
            input_index = input_index % input_shape_i;
            if (signs_i < 0) {
              input_index = input_shape_i - input_index - 1u + starts_i;
            }
            ${J.indicesSet("input_indices","i","input_index")};
          }
          return input_indices;
      }`,dG=(J,Q)=>{let X=J[0].dims,Y=d.size(X),H=Q.axes.length>0?d.normalizeAxes(Q.axes,X.length):[...Array(X.length).keys()],W=k2(J,4);W.forEach((z)=>z!==0||(()=>{throw Error("step cannot be 0")})),W.length===0&&(W=Array(H.length).fill(1));let G=Q.starts.map((z,D)=>vX(z,D,X,H,W)),j=Q.ends.map((z,D)=>vX(z,D,X,H,W));if(H.length!==G.length||H.length!==j.length)throw Error("start, ends and axes should have the same number of elements");if(H.length!==X.length)for(let z=0;z<X.length;++z)H.includes(z)||(G.splice(z,0,0),j.splice(z,0,X[z]),W.splice(z,0,1));let N=W.map((z)=>Math.sign(z));W.forEach((z,D,S)=>{if(z<0){let w=(j[D]-G[D])/z,k=G[D],I=k+w*W[D];G[D]=I,j[D]=k,S[D]=-z}});let V=X.slice(0);H.forEach((z,D)=>{V[z]=Math.ceil((j[z]-G[z])/W[z])});let L={dims:V,dataType:J[0].dataType},B=M0("output",J[0].dataType,V.length),U=a("input",J[0].dataType,J[0].dims.length),E=d.size(V),R=[{name:"outputSize",type:"u32"},{name:"starts",type:"u32",length:G.length},{name:"signs",type:"i32",length:N.length},{name:"steps",type:"u32",length:W.length}],A=[{type:12,data:E},{type:12,data:G},{type:6,data:N},{type:12,data:W},...O0(J[0].dims,V)],P=(z)=>`
      ${z.registerUniforms(R).declareVariables(U,B)}
        ${cG(U,B,X)}
        ${z.mainStart()}
          ${z.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
          let output_indices = ${B.offsetToIndices("global_idx")};
          let input_indices = calculateInputIndices(output_indices);
          ${B.setByOffset("global_idx",U.getByIndices("input_indices"))}
      }`;return{name:"Slice",shaderCache:{hint:`${N.length}_${G.length}_${W.length}`,inputDependencies:["rank"]},getShaderSource:P,getRunData:()=>({outputs:[L],dispatchGroup:{x:Math.ceil(Y/64)},programUniforms:A})}},EV=(J,Q)=>{mG(J.inputs,Q);let X=pG(J.inputs,Q);J.compute(dG(J.inputs,X),{inputs:[0]})},DV=(J)=>{let{starts:Q,ends:X,axes:Y}=J;return c0({starts:Q,ends:X,axes:Y})}}),aD=J0(()=>{A0(),Z0(),J1(),u6(),C0(),uG=(J)=>{if(!J||J.length!==1)throw Error("Softmax op requires 1 input.")},oG=(J,Q)=>{let X=J.inputs[0],Y=X.dims,H=d.size(Y),W=Y.length,G=d.normalizeAxis(Q.axis,W),j=G<Y.length-1,N,V=[];j?(V=Array.from({length:W},(C,T)=>T),V[G]=W-1,V[W-1]=G,N=J.compute(x1(X,V),{inputs:[X],outputs:[-1]})[0]):N=X;let L=N.dims,B=L[W-1],U=H/B,E=t0(B),R=B/E,A=64;U===1&&(A=256);let P=(C,T)=>T===4?`max(max(${C}.x, ${C}.y), max(${C}.z, ${C}.w))`:T===2?`max(${C}.x, ${C}.y)`:T===3?`max(max(${C}.x, ${C}.y), ${C}.z)`:C,z=a("x",N.dataType,N.dims,E),D=M0("result",N.dataType,N.dims,E),S=z.type.value,w=N1(N.dataType)==="f32"?`var threadMax = ${S}(-3.402823e+38f);`:`var threadMax = ${S}(-65504.0h);`,k=(C)=>`
      var<workgroup> rowMaxShared : ${S};
      var<workgroup> rowSumShared : ${S};
      var<workgroup> threadShared : array<${S}, ${A}>;

      fn getValue(row: i32, col: i32, row_stride: i32) -> ${S} {
        let index = row * row_stride + col;
        return x[index];
      }

      fn setValue(row: i32, col: i32, row_stride: i32, value: ${S}) {
        let index = row * row_stride + col;
        result[index] = value;
      }
      ${C.registerUniform("packedCols","i32").declareVariables(z,D)}
      ${C.mainStart(A)}
        let gindex = i32(global_idx);
        let lindex = i32(local_idx);
        const wg = ${A};
        let row = gindex / wg;
        let cols = uniforms.packedCols;
        let row_stride : i32 = uniforms.packedCols;

        // find the rows max
        ${w}
        for (var col = lindex; col < cols; col += wg) {
          let value = getValue(row, col, row_stride);
          threadMax = max(threadMax, value);
        }
        if (lindex < cols) {
          threadShared[lindex] = threadMax;
        }
        workgroupBarrier();

        var reduceSize = min(cols, wg);
        for (var currSize = reduceSize >> 1;  currSize > 0; currSize = reduceSize >> 1) {
          reduceSize = currSize + (reduceSize & 1);
          if (lindex < currSize) {
            threadShared[lindex] = max(threadShared[lindex], threadShared[lindex + reduceSize]);
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowMaxShared = ${S}(${P("threadShared[0]",E)});
        }
        workgroupBarrier();

        // find the rows sum
        var threadSum = ${S}(0.0);
        for (var col = lindex; col < cols; col += wg) {
          let subExp = exp(getValue(row, col, row_stride) - rowMaxShared);
          threadSum += subExp;
        }
        threadShared[lindex] = threadSum;
        workgroupBarrier();

        for (var currSize = wg >> 1;  currSize > 0; currSize = currSize >> 1) {
          if (lindex < currSize) {
            threadShared[lindex] = threadShared[lindex] + threadShared[lindex + currSize];
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowSumShared = ${S}(${d6("threadShared[0]",E)});
        }
        workgroupBarrier();

        // calculate final value for each element in the row
        for (var col = lindex; col < cols; col += wg) {
          let value = exp(getValue(row, col, row_stride) - rowMaxShared) / rowSumShared;
          setValue(row, col, row_stride, value);
        }
      }`,I=J.compute({name:"Softmax",shaderCache:{hint:`${E};${A}`,inputDependencies:["type"]},getRunData:()=>({outputs:[{dims:L,dataType:N.dataType}],dispatchGroup:{x:U},programUniforms:[{type:6,data:R}]}),getShaderSource:k},{inputs:[N],outputs:[j?-1:0]})[0];j&&J.compute(x1(I,V),{inputs:[I]})},AV=(J,Q)=>{uG(J.inputs),oG(J,Q)},zV=(J)=>c0({axis:J.axis})}),iD=J0(()=>{A0(),Z0(),C0(),TX=(J)=>Array.from(J.getBigInt64Array(),Number),sG=(J)=>{if(!J||J.length!==2)throw Error("Tile requires 2 inputs.");if(J[0].dataType!==1&&J[0].dataType!==10&&J[0].dataType!==6&&J[0].dataType!==12)throw Error("Tile only support float, float16, int32, and uint32 data types");if(J[1].dataType!==7)throw Error("Tile `repeats` input should be of int64 data type");if(J[1].dims.length!==1)throw Error("Tile `repeats` input should be 1-D");if(TX(J[1]).length!==J[0].dims.length)throw Error("Tile `repeats` input should have same number of elements as rank of input data tensor")},aG=(J,Q)=>{let X=[];for(let Y=0;Y<J.length;++Y)X.push(J[Y]*Q[Y]);return X},iG=(J,Q)=>{let X=J[0].dims,Y=Q??TX(J[1]),H=aG(X,Y),W=d.size(H),G=J[0].dataType,j=a("input",G,X.length),N=M0("output",G,H.length),V=(L)=>`
      const inputShape = ${j.indices(...X)};
      ${L.registerUniform("output_size","u32").declareVariables(j,N)}
      ${L.mainStart()}
      ${L.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let output_indices = ${N.offsetToIndices("global_idx")};
      var input_indices: ${j.type.indices};
      for (var i = 0; i < ${X.length}; i++) {
        let input_dim_i = ${j.indicesGet("uniforms.input_shape","i")};
        let input_dim_value = ${N.indicesGet("output_indices","i")}  % input_dim_i;

        ${j.indicesSet("input_indices","i","input_dim_value")}
      }
      ${N.setByOffset("global_idx",j.getByIndices("input_indices"))}
    }`;return{name:"Tile",shaderCache:{hint:`${Y}`,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:H,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(W/64)},programUniforms:[{type:12,data:W},...O0(J[0].dims,H)]}),getShaderSource:V}},$V=(J)=>{sG(J.inputs),J.compute(iG(J.inputs),{inputs:[0]})}}),nD=J0(()=>{A0(),Z0(),C0(),nG=(J,Q,X,Y,H)=>{let W=M0("output_data",H,X.length,4),G=a("a_data",Q[1].dataType,Q[1].dims.length,4),j=a("b_data",Q[2].dataType,Q[2].dims.length,4),N=a("c_data",Q[0].dataType,Q[0].dims.length,4),V,L=(B,U,E)=>`select(${U}, ${B}, ${E})`;if(!Y)V=W.setByOffset("global_idx",L(G.getByOffset("global_idx"),j.getByOffset("global_idx"),N.getByOffset("global_idx")));else{let B=(U,E,R="")=>{let A=`a_data[index_a${E}][component_a${E}]`,P=`b_data[index_b${E}][component_b${E}]`,z=`bool(c_data[index_c${E}] & (0xffu << (component_c${E} * 8)))`;return`
            let output_indices${E} = ${W.offsetToIndices(`global_idx * 4u + ${E}u`)};
            let offset_a${E} = ${G.broadcastedIndicesToOffset(`output_indices${E}`,W)};
            let offset_b${E} = ${j.broadcastedIndicesToOffset(`output_indices${E}`,W)};
            let offset_c${E} = ${N.broadcastedIndicesToOffset(`output_indices${E}`,W)};
            let index_a${E} = offset_a${E} / 4u;
            let index_b${E} = offset_b${E} / 4u;
            let index_c${E} = offset_c${E} / 4u;
            let component_a${E} = offset_a${E} % 4u;
            let component_b${E} = offset_b${E} % 4u;
            let component_c${E} = offset_c${E} % 4u;
            ${U}[${E}] = ${R}(${L(A,P,z)});
          `};H===9?V=`
            var data = vec4<u32>(0);
            ${B("data",0,"u32")}
            ${B("data",1,"u32")}
            ${B("data",2,"u32")}
            ${B("data",3,"u32")}
            output_data[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:V=`
            ${B("output_data[global_idx]",0)}
            ${B("output_data[global_idx]",1)}
            ${B("output_data[global_idx]",2)}
            ${B("output_data[global_idx]",3)}
          `}return`
        ${J.registerUniform("vec_size","u32").declareVariables(N,G,j,W)}
        ${J.mainStart()}
        ${J.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${V}
      }`},rG=(J)=>{let Q=J[1].dims,X=J[2].dims,Y=J[0].dims,H=J[1].dataType,W=!(d.areEqual(Q,X)&&d.areEqual(X,Y)),G=Q,j=d.size(Q);if(W){let V=J7.calcShape(J7.calcShape(Q,X,!1),Y,!1);if(!V)throw Error("Can't perform where op on the given tensors");G=V,j=d.size(G)}let N=Math.ceil(j/4);return{name:"Where",shaderCache:{inputDependencies:["rank","rank","rank"]},getShaderSource:(V)=>nG(V,J,G,W,H),getRunData:()=>({outputs:[{dims:G,dataType:H}],dispatchGroup:{x:Math.ceil(j/64/4)},programUniforms:[{type:12,data:N},...O0(Y,Q,X,G)]})}},PV=(J)=>{J.compute(rG(J.inputs))}}),rD=J0(()=>{ND(),R3(),VD(),KD(),MD(),BD(),LD(),DD(),zD(),$D(),PD(),SD(),ZD(),wD(),kD(),CD(),ID(),_D(),bD(),vD(),TD(),xD(),fD(),hD(),yD(),uN(),gD(),lD(),mD(),pD(),cD(),O3(),dD(),uD(),oD(),sD(),aD(),aN(),iD(),u6(),E3(),nD(),SV=new Map([["Abs",[EF]],["Acos",[DF]],["Acosh",[AF]],["Add",[QN]],["ArgMax",[LF,oX]],["ArgMin",[BF,oX]],["Asin",[zF]],["Asinh",[$F]],["Atan",[PF]],["Atanh",[SF]],["Attention",[UF]],["AveragePool",[YV,XV]],["BatchNormalization",[OF]],["BiasAdd",[RF]],["BiasSplitGelu",[JN]],["Cast",[wF,ZF]],["Ceil",[CF]],["Clip",[kF]],["Concat",[VN,KN]],["Conv",[tX,rX]],["ConvTranspose",[zN,AN]],["Cos",[IF]],["Cosh",[_F]],["CumSum",[$N,PN]],["DepthToSpace",[SN,ZN]],["DequantizeLinear",[NV,VV]],["Div",[XN]],["Einsum",[wN,kN]],["Elu",[bF,b2]],["Equal",[YN]],["Erf",[vF]],["Exp",[TF]],["Expand",[CN]],["FastGelu",[IN]],["Floor",[xF]],["FusedConv",[tX,rX]],["Gather",[bN,_N]],["GatherElements",[yN,hN]],["GatherBlockQuantized",[xN,fN]],["GatherND",[vN,TN]],["Gelu",[fF]],["Gemm",[lN,gN]],["GlobalAveragePool",[qV,HV]],["GlobalMaxPool",[FV,jV]],["Greater",[GN]],["GreaterOrEqual",[FN]],["GridSample",[mN,pN]],["GroupQueryAttention",[iN]],["HardSigmoid",[dF,cF]],["InstanceNormalization",[nN]],["LayerNormalization",[rN]],["LeakyRelu",[hF,b2]],["Less",[jN]],["LessOrEqual",[NN]],["Log",[tF]],["MatMul",[tN]],["MatMulNBits",[eN,JV]],["MaxPool",[WV,GV]],["Mul",[HN]],["MultiHeadAttention",[dN,cN]],["Neg",[gF]],["Not",[yF]],["Pad",[QV]],["Pow",[qN]],["QuickGelu",[eF,b2]],["Range",[KV]],["Reciprocal",[lF]],["ReduceMin",[FF]],["ReduceMean",[HF]],["ReduceMax",[jF]],["ReduceSum",[VF]],["ReduceProd",[NF]],["ReduceL1",[qF]],["ReduceL2",[WF]],["ReduceLogSum",[MF]],["ReduceLogSumExp",[GF]],["ReduceSumSquare",[KF]],["Relu",[mF]],["Resize",[LV,UV]],["RotaryEmbedding",[OV]],["ScatterND",[BV,MV]],["Sigmoid",[pF]],["Sin",[uF]],["Sinh",[oF]],["Slice",[EV,DV]],["SkipLayerNormalization",[RV]],["Split",[oN,sN]],["Sqrt",[sF]],["Softmax",[AV,zV]],["Sub",[WN]],["Tan",[aF]],["Tanh",[iF]],["ThresholdedRelu",[rF,b2]],["Tile",[$V]],["Transpose",[oj,sj]],["Where",[PV]]])}),tD=J0(()=>{q6(),x6(),C0(),ZV=class{constructor(J){this.backend=J,this.repo=new Map,this.attributesBound=!1}getArtifact(J){return this.repo.get(J)}setArtifact(J,Q){this.repo.set(J,Q)}run(J,Q,X,Y,H){H6(J.programInfo.name);let W=this.backend.device,G=this.backend.getComputePassEncoder();this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2);let j=[];for(let V of Q)j.push({binding:j.length,resource:{buffer:V.buffer}});for(let V of X)j.push({binding:j.length,resource:{buffer:V.buffer}});H&&j.push({binding:j.length,resource:H});let N=W.createBindGroup({layout:J.computePipeline.getBindGroupLayout(0),entries:j,label:J.programInfo.name});if(this.backend.sessionStatus==="capturing"){let V={kernelId:this.backend.currentKernelId,computePipeline:J.computePipeline,bindGroup:N,dispatchGroup:Y};this.backend.capturedCommandList.get(this.backend.currentSessionId).push(V)}G.setPipeline(J.computePipeline),G.setBindGroup(0,N),G.dispatchWorkgroups(...Y),this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2+1),this.backend.pendingDispatchNumber++,(this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber||this.backend.queryType==="at-passes")&&this.backend.endComputePass(),this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber&&this.backend.flush(),m1(J.programInfo.name)}dispose(){}build(J,Q){H6(J.name);let X=this.backend.device,Y=[];[{feature:"shader-f16",extension:"f16"},{feature:"subgroups",extension:"subgroups"},{feature:"subgroups-f16",extension:"subgroups_f16"}].forEach((V)=>{X.features.has(V.feature)&&Y.push(`enable ${V.extension};`)});let H=uj(Q,this.backend.device.limits),W=J.getShaderSource(H),G=`${Y.join(`
`)}
${H.additionalImplementations}
${W}`,j=X.createShaderModule({code:G,label:J.name});x0("verbose",()=>`[WebGPU] ${J.name} shader code: ${G}`);let N=X.createComputePipeline({compute:{module:j,entryPoint:"main"},layout:"auto",label:J.name});return m1(J.name),{programInfo:J,computePipeline:N,uniformVariablesInfo:H.variablesInfo}}normalizeDispatchGroupSize(J){let Q=typeof J=="number"?J:J.x,X=typeof J=="number"?1:J.y||1,Y=typeof J=="number"?1:J.z||1,H=this.backend.device.limits.maxComputeWorkgroupsPerDimension;if(Q<=H&&X<=H&&Y<=H)return[Q,X,Y];let W=Q*X*Y,G=Math.ceil(Math.sqrt(W));if(G>H){if(G=Math.ceil(Math.cbrt(W)),G>H)throw Error("Total dispatch size exceeds WebGPU maximum.");return[G,G,G]}else return[G,G,1]}}}),eD=J0(()=>{q6(),A0(),x6(),gj(),jD(),rD(),tD(),tG=(J,Q)=>{if(Q.length!==J.length)throw Error(`inputDependencies length ${Q.length} is not equal to inputTensors length ${J.length}.`);let X=[];for(let Y=0;Y<J.length;++Y){let H=J[Y].dataType;switch(Q[Y]){case"none":{X.push("");break}case"type":{X.push(`${H}`);break}case"rank":{let W=J[Y].dims.length;X.push(`${H};${W}`);break}case"dims":{let W=J[Y].dims.join(",");X.push(`${H};${W}`);break}default:throw Error(`unsupported input dependency: ${Q[Y]}`)}}return X.join("|")},eG=(J,Q,X)=>{let Y=J.name;return J.shaderCache?.hint&&(Y+="["+J.shaderCache.hint+"]"),Y+=":"+X+`:${tG(Q,J.shaderCache?.inputDependencies??Array(Q.length).fill("dims"))}`,Y},Jj=class{constructor(J){J&&(this.architecture=J.architecture,this.vendor=J.vendor)}isArchitecture(J){return this.architecture===J}isVendor(J){return this.vendor===J}},Qj=class{constructor(J){this.subgroupsSupported=J.features.has("subgroups"),this.subgroupsF16Supported=J.features.has("subgroups");let Q=J.limits;!this.subgroupsSupported||!Q.minSubgroupSize||!Q.maxSubgroupSize?this.subgroupSizeRange=void 0:this.subgroupSizeRange=[Q.minSubgroupSize,Q.maxSubgroupSize]}},wV=class{constructor(){this.currentSessionId=null,this.currentKernelId=null,this.commandEncoder=null,this.computePassEncoder=null,this.maxDispatchNumber=16,this.pendingDispatchNumber=0,this.pendingKernels=[],this.pendingQueries=new Map,this.sessionStatus="default",this.capturedCommandList=new Map,this.capturedPendingKernels=new Map,this.sessionExternalDataMapping=new Map}get currentKernelCustomData(){if(this.currentKernelId===null)throw Error("currentKernelCustomData(): currentKernelId is null. (should not happen)");let J=this.kernelCustomData.get(this.currentKernelId);return J||(J={},this.kernelCustomData.set(this.currentKernelId,J)),J}async initialize(J,Q){this.env=J;let X=[],Y={requiredLimits:{maxComputeWorkgroupStorageSize:Q.limits.maxComputeWorkgroupStorageSize,maxComputeWorkgroupsPerDimension:Q.limits.maxComputeWorkgroupsPerDimension,maxStorageBufferBindingSize:Q.limits.maxStorageBufferBindingSize,maxBufferSize:Q.limits.maxBufferSize,maxComputeInvocationsPerWorkgroup:Q.limits.maxComputeInvocationsPerWorkgroup,maxComputeWorkgroupSizeX:Q.limits.maxComputeWorkgroupSizeX,maxComputeWorkgroupSizeY:Q.limits.maxComputeWorkgroupSizeY,maxComputeWorkgroupSizeZ:Q.limits.maxComputeWorkgroupSizeZ},requiredFeatures:X},H=(W)=>Q.features.has(W)&&X.push(W)&&!0;H("chromium-experimental-timestamp-query-inside-passes")||H("timestamp-query"),H("shader-f16"),H("subgroups")&&H("subgroups-f16"),this.device=await Q.requestDevice(Y),this.deviceInfo=new Qj(this.device),this.adapterInfo=new Jj(Q.info||await Q.requestAdapterInfo()),this.gpuDataManager=lj(this),this.programManager=new ZV(this),this.kernels=new Map,this.kernelPersistentData=new Map,this.kernelCustomData=new Map,M3(J.logLevel,!!J.debug),this.device.onuncapturederror=(W)=>{W.error instanceof GPUValidationError&&console.error(`An uncaught WebGPU validation error was raised: ${W.error.message}`)},Object.defineProperty(this.env.webgpu,"device",{value:this.device,writable:!1,enumerable:!0,configurable:!1}),Object.defineProperty(this.env.webgpu,"adapter",{value:Q,writable:!1,enumerable:!0,configurable:!1}),this.setQueryType()}dispose(){typeof this.querySet<"u"&&this.querySet.destroy(),this.gpuDataManager.dispose()}getCommandEncoder(){return this.commandEncoder||(this.commandEncoder=this.device.createCommandEncoder()),this.commandEncoder}getComputePassEncoder(){if(!this.computePassEncoder){let J=this.getCommandEncoder(),Q={};this.queryType==="at-passes"&&(Q.timestampWrites={querySet:this.querySet,beginningOfPassWriteIndex:this.pendingDispatchNumber*2,endOfPassWriteIndex:this.pendingDispatchNumber*2+1}),this.computePassEncoder=J.beginComputePass(Q)}return this.computePassEncoder}endComputePass(){this.computePassEncoder&&(this.computePassEncoder.end(),this.computePassEncoder=null)}flush(){if(!this.commandEncoder)return;H6(),this.endComputePass();let J;this.queryType!=="none"&&(this.commandEncoder.resolveQuerySet(this.querySet,0,this.pendingDispatchNumber*2,this.queryResolveBuffer,0),J=this.device.createBuffer({size:this.pendingDispatchNumber*2*8,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.pendingQueries.set(J,this.pendingKernels),this.pendingKernels=[],this.commandEncoder.copyBufferToBuffer(this.queryResolveBuffer,0,J,0,this.pendingDispatchNumber*2*8)),this.device.queue.submit([this.commandEncoder.finish()]),this.gpuDataManager.refreshPendingBuffers(),this.commandEncoder=null,this.pendingDispatchNumber=0,this.queryType!=="none"&&J.mapAsync(GPUMapMode.READ).then(()=>{let Q=new BigUint64Array(J.getMappedRange()),X=this.pendingQueries.get(J);for(let Y=0;Y<Q.length/2;Y++){let H=X[Y],W=H.kernelId,G=this.kernels.get(W),j=G.kernelType,N=G.kernelName,V=H.programName,L=H.inputTensorViews,B=H.outputTensorViews,U=Q[Y*2],E=Q[Y*2+1];typeof this.queryTimeBase>"u"&&(this.queryTimeBase=U);let R=Number(U-this.queryTimeBase),A=Number(E-this.queryTimeBase);if(!Number.isSafeInteger(R)||!Number.isSafeInteger(A))throw RangeError("incorrect timestamp range");if(this.env.webgpu.profiling?.ondata)this.env.webgpu.profiling.ondata({version:1,inputsMetadata:L.map((P)=>({dims:P.dims,dataType:Z8(P.dataType)})),outputsMetadata:B.map((P)=>({dims:P.dims,dataType:Z8(P.dataType)})),kernelId:W,kernelType:j,kernelName:N,programName:V,startTime:R,endTime:A});else{let P="";L.forEach((D,S)=>{P+=`input[${S}]: [${D.dims}] | ${Z8(D.dataType)}, `});let z="";B.forEach((D,S)=>{z+=`output[${S}]: [${D.dims}] | ${Z8(D.dataType)}, `}),console.log(`[profiling] kernel "${W}|${j}|${N}|${V}" ${P}${z}execution time: ${A-R} ns`)}x2("GPU",`${V}::${U}::${E}`)}J.unmap(),this.pendingQueries.delete(J)}),m1()}run(J,Q,X,Y,H,W){H6(J.name);let G=[];for(let D=0;D<Q.length;++D){let S=Q[D].data;if(S===0)continue;let w=this.gpuDataManager.get(S);if(!w)throw Error(`no GPU data for input: ${S}`);G.push(w)}let{outputs:j,dispatchGroup:N,programUniforms:V}=J.getRunData(Q),L=X.length===0?j.map((D,S)=>S):X;if(L.length!==j.length)throw Error(`Output size ${L.length} must be equal to ${j.length}.`);let B=[],U=[];for(let D=0;D<j.length;++D){if(!Number.isInteger(L[D])||L[D]<-3||L[D]>=W)throw Error(`Invalid output index: ${L[D]}`);if(L[D]===-3)continue;let S=L[D]===-1,w=L[D]===-2,k=S||w?H(j[D].dataType,j[D].dims):Y(L[D],j[D].dataType,j[D].dims);if(B.push(k),k.data===0)continue;let I=this.gpuDataManager.get(k.data);if(!I)throw Error(`no GPU data for output: ${k.data}`);if(S&&this.temporaryData.push(I),w){let C=this.kernelPersistentData.get(this.currentKernelId);C||(C=[],this.kernelPersistentData.set(this.currentKernelId,C)),C.push(I)}U.push(I)}if(G.length!==Q.length||U.length!==B.length){if(U.length===0)return m1(J.name),B;throw Error(`Program ${J.name} has zero-sized tensor(s) in inputs or outputs. This is not supported now.`)}let E;if(V){let D=0,S=[];V.forEach((C)=>{let T=typeof C.data=="number"?[C.data]:C.data;if(T.length===0)return;let g=C.type===10?2:4,m,l;C.type===10?(l=T.length>4?16:T.length>2?8:T.length*g,m=T.length>4?16:g*T.length):(l=T.length<=2?T.length*g:16,m=16),D=Math.ceil(D/l)*l,S.push(D);let t=C.type===10?8:4;D+=T.length>4?Math.ceil(T.length/t)*m:T.length*g});let w=16;D=Math.ceil(D/w)*w;let k=new ArrayBuffer(D);V.forEach((C,T)=>{let g=S[T],m=typeof C.data=="number"?[C.data]:C.data;if(C.type===6)new Int32Array(k,g,m.length).set(m);else if(C.type===12)new Uint32Array(k,g,m.length).set(m);else if(C.type===10)new Uint16Array(k,g,m.length).set(m);else if(C.type===1)new Float32Array(k,g,m.length).set(m);else throw Error(`Unsupported uniform type: ${Z8(C.type)}`)});let I=this.gpuDataManager.create(D,GPUBufferUsage.COPY_DST|GPUBufferUsage.UNIFORM);this.device.queue.writeBuffer(I.buffer,0,k,0,D),this.gpuDataManager.release(I.id),E={offset:0,size:D,buffer:I.buffer}}let R=this.programManager.normalizeDispatchGroupSize(N),A=R[1]===1&&R[2]===1,P=eG(J,Q,A),z=this.programManager.getArtifact(P);if(z||(z=this.programManager.build(J,R),this.programManager.setArtifact(P,z),x0("info",()=>`[artifact] key: ${P}, programName: ${J.name}`)),V&&z.uniformVariablesInfo){if(V.length!==z.uniformVariablesInfo.length)throw Error(`Uniform variables count mismatch: expect ${z.uniformVariablesInfo.length}, got ${V.length} in program "${z.programInfo.name}".`);for(let D=0;D<V.length;D++){let S=V[D],w=S.type,k=typeof S.data=="number"?1:S.data.length,[I,C]=z.uniformVariablesInfo[D];if(w!==I||k!==C)throw Error(`Uniform variable ${D} mismatch: expect type ${I} with size ${C}, got type ${w} with size ${k} in program "${z.programInfo.name}".`)}}if(x0("info",()=>`[ProgramManager] run "${J.name}" (key=${P}) with ${R[0]}x${R[1]}x${R[2]}`),this.queryType!=="none"||this.sessionStatus==="capturing"){let D={kernelId:this.currentKernelId,programName:z.programInfo.name,inputTensorViews:Q,outputTensorViews:B};this.pendingKernels.push(D),this.sessionStatus==="capturing"&&this.capturedPendingKernels.get(this.currentSessionId).push(D)}return this.programManager.run(z,G,U,R,E),m1(J.name),B}upload(J,Q){this.gpuDataManager.upload(J,Q)}memcpy(J,Q){this.gpuDataManager.memcpy(J,Q)}async download(J,Q){await this.gpuDataManager.download(J,Q)}alloc(J){return this.gpuDataManager.create(J).id}free(J){return this.gpuDataManager.release(J)}createKernel(J,Q,X,Y){let H=SV.get(J);if(!H)throw Error(`kernel not implemented: ${J}`);let W={kernelType:J,kernelName:Y,kernelEntry:H[0],attributes:[H[1],X]};this.kernels.set(Q,W)}releaseKernel(J){let Q=this.kernelPersistentData.get(J);if(Q){for(let X of Q)this.gpuDataManager.release(X.id);this.kernelPersistentData.delete(J)}this.kernelCustomData.delete(J),this.kernels.delete(J)}computeKernel(J,Q,X){let Y=this.kernels.get(J);if(!Y)throw Error(`kernel not created: ${J}`);let{kernelType:H,kernelName:W,kernelEntry:G,attributes:j}=Y;if(this.currentKernelId!==null)throw Error(`kernel "[${H}] ${W}" is not allowed to be called recursively`);this.currentKernelId=J,j[0]&&(j[1]=j[0](j[1]),j[0]=void 0),x0("info",()=>`[WebGPU] Start to run kernel "[${H}] ${W}"...`);let N=this.env.debug;this.temporaryData=[];try{return N&&this.device.pushErrorScope("validation"),G(Q,j[1]),0}catch(V){return X.push(Promise.resolve(`[WebGPU] Kernel "[${H}] ${W}" failed. ${V}`)),1}finally{N&&X.push(this.device.popErrorScope().then((V)=>V?`GPU validation error for kernel "[${H}] ${W}": ${V.message}`:null));for(let V of this.temporaryData)this.gpuDataManager.release(V.id);this.temporaryData=[],this.currentKernelId=null}}registerBuffer(J,Q,X,Y){let H=this.sessionExternalDataMapping.get(J);H||(H=new Map,this.sessionExternalDataMapping.set(J,H));let W=H.get(Q),G=this.gpuDataManager.registerExternalBuffer(X,Y,W);return H.set(Q,[G,X]),G}unregisterBuffers(J){let Q=this.sessionExternalDataMapping.get(J);Q&&(Q.forEach((X)=>this.gpuDataManager.unregisterExternalBuffer(X[0])),this.sessionExternalDataMapping.delete(J))}getBuffer(J){let Q=this.gpuDataManager.get(J);if(!Q)throw Error(`no GPU data for buffer: ${J}`);return Q.buffer}createDownloader(J,Q,X){return async()=>{let Y=await cX(this,J,Q);return B3(Y.buffer,X)}}writeTimestamp(J){this.queryType==="inside-passes"&&this.computePassEncoder.writeTimestamp(this.querySet,J)}setQueryType(){this.queryType="none",(this.env.webgpu.profiling?.mode==="default"||(typeof this.env.trace>"u"?this.env.wasm.trace:this.env.trace))&&(this.device.features.has("chromium-experimental-timestamp-query-inside-passes")?this.queryType="inside-passes":this.device.features.has("timestamp-query")&&(this.queryType="at-passes"),this.queryType!=="none"&&typeof this.querySet>"u"&&(this.querySet=this.device.createQuerySet({type:"timestamp",count:this.maxDispatchNumber*2}),this.queryResolveBuffer=this.device.createBuffer({size:this.maxDispatchNumber*2*8,usage:GPUBufferUsage.COPY_SRC|GPUBufferUsage.QUERY_RESOLVE})))}captureBegin(){x0("info","captureBegin"),this.capturedCommandList.get(this.currentSessionId)||this.capturedCommandList.set(this.currentSessionId,[]),this.capturedPendingKernels.get(this.currentSessionId)||this.capturedPendingKernels.set(this.currentSessionId,[]),this.flush(),this.sessionStatus="capturing"}captureEnd(){x0("info","captureEnd"),this.flush(),this.sessionStatus="default"}replay(){x0("info","replay"),this.sessionStatus="replaying";let J=this.capturedCommandList.get(this.currentSessionId),Q=this.capturedPendingKernels.get(this.currentSessionId),X=J.length;this.pendingKernels=[];for(let Y=0;Y<X;Y++){let H=this.getComputePassEncoder(),W=J[Y];this.writeTimestamp(this.pendingDispatchNumber*2),H.setPipeline(W.computePipeline),H.setBindGroup(0,W.bindGroup),H.dispatchWorkgroups(...W.dispatchGroup),this.writeTimestamp(this.pendingDispatchNumber*2+1),this.pendingDispatchNumber++,this.queryType!=="none"&&this.pendingKernels.push(Q[Y]),(this.pendingDispatchNumber>=this.maxDispatchNumber||this.queryType==="at-passes")&&this.endComputePass(),this.pendingDispatchNumber>=this.maxDispatchNumber&&this.flush()}this.flush(),this.sessionStatus="default"}onCreateSession(){this.gpuDataManager.onCreateSession()}onReleaseSession(J){this.unregisterBuffers(J),this.capturedCommandList.has(J)&&this.capturedCommandList.delete(J),this.capturedPendingKernels.has(J)&&this.capturedPendingKernels.delete(J),this.gpuDataManager.onReleaseSession(J)}onRunStart(J){this.currentSessionId=J,this.setQueryType()}}}),JA=J0(()=>{x6(),Xj=1,xX=()=>Xj++,Yj=new Map([["float32",32],["float16",16],["int32",32],["uint32",32],["int64",64],["uint64",64],["int8",8],["uint8",8],["int4",4],["uint4",4]]),fX=(J,Q)=>{let X=Yj.get(J);if(!X)throw Error("Unsupported data type.");return Q.length>0?Math.ceil(Q.reduce((Y,H)=>Y*H)*X/8):0},hX=class{constructor(J){this.sessionId=J.sessionId,this.mlContext=J.context,this.mlTensor=J.tensor,this.dataType=J.dataType,this.tensorShape=J.shape}get tensor(){return this.mlTensor}get type(){return this.dataType}get shape(){return this.tensorShape}get byteLength(){return fX(this.dataType,this.tensorShape)}destroy(){x0("verbose",()=>"[WebNN] TensorWrapper.destroy"),this.mlTensor.destroy()}write(J){this.mlContext.writeTensor(this.mlTensor,J)}async read(J){return J?this.mlContext.readTensor(this.mlTensor,J):this.mlContext.readTensor(this.mlTensor)}canReuseTensor(J,Q,X){return this.mlContext===J&&this.dataType===Q&&this.tensorShape.length===X.length&&this.tensorShape.every((Y,H)=>Y===X[H])}},yX=class{constructor(J,Q){this.tensorManager=J,this.wrapper=Q}get tensorWrapper(){return this.wrapper}releaseTensor(){this.tensorWrapper&&(this.tensorManager.releaseTensor(this.tensorWrapper),this.wrapper=void 0)}async ensureTensor(J,Q,X,Y){let H=this.tensorManager.getMLContext(J);if(this.wrapper){if(this.wrapper.canReuseTensor(H,Q,X))return this.wrapper.tensor;if(Y){if(this.wrapper.byteLength!==fX(Q,X))throw Error("Unable to copy data to tensor with different size.");this.activeUpload=new Uint8Array(await this.wrapper.read())}this.tensorManager.releaseTensor(this.wrapper)}let W=typeof MLTensorUsage>"u"?void 0:MLTensorUsage.READ|MLTensorUsage.WRITE;return this.wrapper=await this.tensorManager.getCachedTensor(J,Q,X,W,!0,!0),Y&&this.activeUpload&&(this.wrapper.write(this.activeUpload),this.activeUpload=void 0),this.wrapper.tensor}upload(J){if(this.wrapper)if(J.byteLength===this.wrapper.byteLength){this.wrapper.write(J);return}else x0("verbose",()=>"Data size does not match tensor size. Releasing tensor."),this.releaseTensor();this.activeUpload?this.activeUpload.set(J):this.activeUpload=new Uint8Array(J)}async download(J){if(this.activeUpload)if(J){J instanceof ArrayBuffer?new Uint8Array(J).set(this.activeUpload):new Uint8Array(J.buffer,J.byteOffset,J.byteLength).set(this.activeUpload);return}else return this.activeUpload.buffer;if(!this.wrapper)throw Error("Tensor has not been created.");return J?this.wrapper.read(J):this.wrapper.read()}},Hj=class{constructor(J){this.backend=J,this.tensorTrackersById=new Map,this.freeTensors=[],this.externalTensors=new Set}getMLContext(J){let Q=this.backend.getMLContext(J);if(!Q)throw Error("MLContext not found for session.");return Q}reserveTensorId(){let J=xX();return this.tensorTrackersById.set(J,new yX(this)),J}releaseTensorId(J){let Q=this.tensorTrackersById.get(J);Q&&(this.tensorTrackersById.delete(J),Q.tensorWrapper&&this.releaseTensor(Q.tensorWrapper))}async ensureTensor(J,Q,X,Y,H){x0("verbose",()=>`[WebNN] TensorManager.ensureTensor {tensorId: ${Q}, dataType: ${X}, shape: ${Y}, copyOld: ${H}}`);let W=this.tensorTrackersById.get(Q);if(!W)throw Error("Tensor not found.");return W.ensureTensor(J,X,Y,H)}upload(J,Q){let X=this.tensorTrackersById.get(J);if(!X)throw Error("Tensor not found.");X.upload(Q)}async download(J,Q){x0("verbose",()=>`[WebNN] TensorManager.download {tensorId: ${J}, dstBuffer: ${Q?.byteLength}}`);let X=this.tensorTrackersById.get(J);if(!X)throw Error("Tensor not found.");return X.download(Q)}releaseTensorsForSession(J){for(let Q of this.freeTensors)Q.sessionId===J&&Q.destroy();this.freeTensors=this.freeTensors.filter((Q)=>Q.sessionId!==J)}registerTensor(J,Q,X,Y){let H=this.getMLContext(J),W=xX(),G=new hX({sessionId:J,context:H,tensor:Q,dataType:X,shape:Y});return this.tensorTrackersById.set(W,new yX(this,G)),this.externalTensors.add(G),W}async getCachedTensor(J,Q,X,Y,H,W){let G=this.getMLContext(J);for(let[N,V]of this.freeTensors.entries())if(V.canReuseTensor(G,Q,X)){x0("verbose",()=>`[WebNN] Reusing tensor {dataType: ${Q}, shape: ${X}}`);let L=this.freeTensors.splice(N,1)[0];return L.sessionId=J,L}x0("verbose",()=>`[WebNN] MLContext.createTensor {dataType: ${Q}, shape: ${X}}`);let j=await G.createTensor({dataType:Q,shape:X,dimensions:X,usage:Y,writable:H,readable:W});return new hX({sessionId:J,context:G,tensor:j,dataType:Q,shape:X})}releaseTensor(J){this.externalTensors.has(J)&&this.externalTensors.delete(J),this.freeTensors.push(J)}},kV=(...J)=>new Hj(...J)}),QA=J0(()=>{A0(),b8(),gj(),JA(),x6(),b5=new Map([[1,"float32"],[10,"float16"],[6,"int32"],[12,"uint32"],[7,"int64"],[13,"uint64"],[22,"int4"],[21,"uint4"],[3,"int8"],[2,"uint8"],[9,"uint8"]]),qj=(J,Q)=>{if(J===Q)return!0;if(J===void 0||Q===void 0)return!1;let X=Object.keys(J).sort(),Y=Object.keys(Q).sort();return X.length===Y.length&&X.every((H,W)=>H===Y[W]&&J[H]===Q[H])},CV=class{constructor(J){this.tensorManager=kV(this),this.mlContextBySessionId=new Map,this.sessionIdsByMLContext=new Map,this.mlContextCache=[],this.sessionGraphInputs=new Map,this.temporaryGraphInputs=[],this.temporarySessionTensorIds=new Map,M3(J.logLevel,!!J.debug)}get currentSessionId(){if(this.activeSessionId===void 0)throw Error("No active session");return this.activeSessionId}onRunStart(J){x0("verbose",()=>`[WebNN] onRunStart {sessionId: ${J}}`),this.activeSessionId=J}onRunEnd(J){x0("verbose",()=>`[WebNN] onRunEnd {sessionId: ${J}}`);let Q=this.temporarySessionTensorIds.get(J);if(Q){for(let X of Q)x0("verbose",()=>`[WebNN] releasing temporary tensor {tensorId: ${X}}`),this.tensorManager.releaseTensorId(X);this.temporarySessionTensorIds.delete(J),this.activeSessionId=void 0}}async createMLContext(J){if(J instanceof GPUDevice){let X=this.mlContextCache.findIndex((Y)=>Y.gpuDevice===J);if(X!==-1)return this.mlContextCache[X].mlContext;{let Y=await navigator.ml.createContext(J);return this.mlContextCache.push({gpuDevice:J,mlContext:Y}),Y}}else if(J===void 0){let X=this.mlContextCache.findIndex((Y)=>Y.options===void 0&&Y.gpuDevice===void 0);if(X!==-1)return this.mlContextCache[X].mlContext;{let Y=await navigator.ml.createContext();return this.mlContextCache.push({mlContext:Y}),Y}}let Q=this.mlContextCache.findIndex((X)=>qj(X.options,J));if(Q!==-1)return this.mlContextCache[Q].mlContext;{let X=await navigator.ml.createContext(J);return this.mlContextCache.push({options:J,mlContext:X}),X}}registerMLContext(J,Q){this.mlContextBySessionId.set(J,Q);let X=this.sessionIdsByMLContext.get(Q);X||(X=new Set,this.sessionIdsByMLContext.set(Q,X)),X.add(J),this.temporaryGraphInputs.length>0&&(this.sessionGraphInputs.set(J,this.temporaryGraphInputs),this.temporaryGraphInputs=[])}onReleaseSession(J){this.sessionGraphInputs.delete(J);let Q=this.mlContextBySessionId.get(J);if(!Q)return;this.tensorManager.releaseTensorsForSession(J),this.mlContextBySessionId.delete(J);let X=this.sessionIdsByMLContext.get(Q);if(X.delete(J),X.size===0){this.sessionIdsByMLContext.delete(Q);let Y=this.mlContextCache.findIndex((H)=>H.mlContext===Q);Y!==-1&&this.mlContextCache.splice(Y,1)}}getMLContext(J){return this.mlContextBySessionId.get(J)}reserveTensorId(){return this.tensorManager.reserveTensorId()}releaseTensorId(J){x0("verbose",()=>`[WebNN] releaseTensorId {tensorId: ${J}}`),this.tensorManager.releaseTensorId(J)}async ensureTensor(J,Q,X,Y,H){let W=b5.get(X);if(!W)throw Error(`Unsupported ONNX data type: ${X}`);return this.tensorManager.ensureTensor(J??this.currentSessionId,Q,W,Y,H)}async createTemporaryTensor(J,Q,X){x0("verbose",()=>`[WebNN] createTemporaryTensor {onnxDataType: ${Q}, shape: ${X}}`);let Y=b5.get(Q);if(!Y)throw Error(`Unsupported ONNX data type: ${Q}`);let H=this.tensorManager.reserveTensorId();await this.tensorManager.ensureTensor(J,H,Y,X,!1);let W=this.temporarySessionTensorIds.get(J);return W?W.push(H):this.temporarySessionTensorIds.set(J,[H]),H}uploadTensor(J,Q){if(!F1().shouldTransferToMLTensor)throw Error("Trying to upload to a MLTensor while shouldTransferToMLTensor is false");x0("verbose",()=>`[WebNN] uploadTensor {tensorId: ${J}, data: ${Q.byteLength}}`),this.tensorManager.upload(J,Q)}async downloadTensor(J,Q){return this.tensorManager.download(J,Q)}createMLTensorDownloader(J,Q){return async()=>{let X=await this.tensorManager.download(J);return B3(X,Q)}}registerMLTensor(J,Q,X,Y){let H=b5.get(X);if(!H)throw Error(`Unsupported ONNX data type: ${X}`);let W=this.tensorManager.registerTensor(J,Q,H,Y);return x0("verbose",()=>`[WebNN] registerMLTensor {tensor: ${Q}, dataType: ${H}, dimensions: ${Y}} -> {tensorId: ${W}}`),W}registerMLConstant(J,Q,X,Y,H,W){if(!W)throw Error("External mounted files are not available.");let G=J;J.startsWith("./")&&(G=J.substring(2));let j=W.get(G);if(!j)throw Error(`File with name ${G} not found in preloaded files.`);if(Q+X>j.byteLength)throw Error("Out of bounds: data offset and length exceed the external file data size.");let N=j.slice(Q,Q+X).buffer,V;switch(H.dataType){case"float32":V=new Float32Array(N);break;case"float16":V=new Uint16Array(N);break;case"int32":V=new Int32Array(N);break;case"uint32":V=new Uint32Array(N);break;case"int64":V=new BigInt64Array(N);break;case"uint64":V=new BigUint64Array(N);break;case"int8":V=new Int8Array(N);break;case"int4":case"uint4":case"uint8":V=new Uint8Array(N);break;default:throw Error(`Unsupported data type: ${H.dataType} in creating WebNN Constant from external data.`)}return x0("verbose",()=>`[WebNN] registerMLConstant {dataType: ${H.dataType}, shape: ${H.shape}}}`),Y.constant(H,V)}registerGraphInput(J){this.temporaryGraphInputs.push(J)}isGraphInput(J,Q){let X=this.sessionGraphInputs.get(J);return X?X.includes(Q):!1}flush(){}}}),IV={};h2(IV,{init:()=>_V});XA=J0(()=>{A0(),eD(),x6(),Z0(),QA(),v5=class J{constructor(Q,X,Y,H){this.module=Q,this.dataType=X,this.data=Y,this.dims=H}getFloat32Array(){if(this.dataType!==1)throw Error("Invalid data type");let Q=d.size(this.dims);return Q===0?new Float32Array:new Float32Array(this.module.HEAP8.buffer,this.data,Q)}getBigInt64Array(){if(this.dataType!==7)throw Error("Invalid data type");let Q=d.size(this.dims);return Q===0?new BigInt64Array:new BigInt64Array(this.module.HEAP8.buffer,this.data,Q)}getInt32Array(){if(this.dataType!==6)throw Error("Invalid data type");let Q=d.size(this.dims);return Q===0?new Int32Array:new Int32Array(this.module.HEAP8.buffer,this.data,Q)}getUint16Array(){if(this.dataType!==10&&this.dataType!==4)throw Error("Invalid data type");let Q=d.size(this.dims);return Q===0?new Uint16Array:new Uint16Array(this.module.HEAP8.buffer,this.data,Q)}reshape(Q){if(d.size(Q)!==d.size(this.dims))throw Error("Invalid new shape");return new J(this.module,this.dataType,this.data,Q)}},Wj=class{constructor(J,Q,X){this.module=J,this.backend=Q,this.customDataOffset=0,this.customDataSize=0,this.adapterInfo=Q.adapterInfo,this.deviceInfo=Q.deviceInfo;let Y=J.PTR_SIZE,H=X/J.PTR_SIZE,W=Y===4?"i32":"i64";this.opKernelContext=Number(J.getValue(Y*H++,W));let G=Number(J.getValue(Y*H++,W));this.outputCount=Number(J.getValue(Y*H++,W)),this.customDataOffset=Number(J.getValue(Y*H++,"*")),this.customDataSize=Number(J.getValue(Y*H++,W));let j=[];for(let N=0;N<G;N++){let V=Number(J.getValue(Y*H++,W)),L=Number(J.getValue(Y*H++,"*")),B=Number(J.getValue(Y*H++,W)),U=[];for(let E=0;E<B;E++)U.push(Number(J.getValue(Y*H++,W)));j.push(new v5(J,V,L,U))}this.inputs=j}get kernelCustomData(){return this.backend.currentKernelCustomData}get customDataBuffer(){return this.module.HEAPU8.subarray(this.customDataOffset,this.customDataOffset+this.customDataSize)}compute(J,Q){let X=Q?.inputs?.map((G)=>typeof G=="number"?this.inputs[G]:G)??this.inputs,Y=Q?.outputs??[],H=(G,j,N)=>new v5(this.module,j,this.output(G,N),N),W=(G,j)=>{let N=w8(G,j);if(!N)throw Error(`Unsupported data type: ${G}`);let V=N>0?this.backend.gpuDataManager.create(N).id:0;return new v5(this.module,G,V,j)};return this.backend.run(J,X,Y,H,W,this.outputCount)}output(J,Q){let X=this.module.stackSave();try{let Y=this.module.PTR_SIZE,H=Y===4?"i32":"i64",W=this.module.stackAlloc((1+Q.length)*Y);this.module.setValue(W,Q.length,H);for(let G=0;G<Q.length;G++)this.module.setValue(W+Y*(G+1),Q[G],H);return this.module._JsepOutput(this.opKernelContext,J,W)}catch(Y){throw Error(`Failed to generate kernel's output[${J}] with dims [${Q}]. If you are running with pre-allocated output, please make sure the output type/dims are correct. Error: ${Y}`)}finally{this.module.stackRestore(X)}}},_V=async(J,Q,X,Y)=>{let H=Q.jsepInit;if(!H)throw Error("Failed to initialize JSEP. The WebAssembly module is not built with JSEP support.");if(J==="webgpu"){let W=new wV;await W.initialize(X,Y),H("webgpu",[W,(G)=>W.alloc(Number(G)),(G)=>W.free(G),(G,j,N,V=!1)=>{if(V)x0("verbose",()=>`[WebGPU] jsepCopyGpuToGpu: src=${Number(G)}, dst=${Number(j)}, size=${Number(N)}`),W.memcpy(Number(G),Number(j));else{x0("verbose",()=>`[WebGPU] jsepCopyCpuToGpu: dataOffset=${Number(G)}, gpuDataId=${Number(j)}, size=${Number(N)}`);let L=Q.HEAPU8.subarray(Number(G>>>0),Number(G>>>0)+Number(N));W.upload(Number(j),L)}},async(G,j,N)=>{x0("verbose",()=>`[WebGPU] jsepCopyGpuToCpu: gpuDataId=${G}, dataOffset=${j}, size=${N}`),await W.download(Number(G),()=>Q.HEAPU8.subarray(Number(j)>>>0,Number(j+N)>>>0))},(G,j,N)=>W.createKernel(G,Number(j),N,Q.UTF8ToString(Q._JsepGetNodeName(Number(j)))),(G)=>W.releaseKernel(G),(G,j,N,V)=>{x0("verbose",()=>`[WebGPU] jsepRun: sessionHandle=${N}, kernel=${G}, contextDataOffset=${j}`);let L=new Wj(Q,W,Number(j));return W.computeKernel(Number(G),L,V)},()=>W.captureBegin(),()=>W.captureEnd(),()=>W.replay()])}else{let W=new CV(X);H("webnn",[W,()=>W.reserveTensorId(),(G)=>W.releaseTensorId(G),async(G,j,N,V,L)=>W.ensureTensor(G,j,N,V,L),(G,j)=>{W.uploadTensor(G,j)},async(G,j)=>W.downloadTensor(G,j)])}}}),bV=J0(()=>{WD(),GD(),A0(),b8(),j3(),yj(),Gj=(J,Q)=>{F1()._OrtInit(J,Q)!==0&&m0("Can't initialize onnxruntime.")},S3=async(J)=>{Gj(J.wasm.numThreads,g5(J.logLevel))},Z3=async(J,Q)=>{{let X=(XA(),h5(IV)).init;if(Q==="webgpu"){if(typeof navigator>"u"||!navigator.gpu)throw Error("WebGPU is not supported in current environment");let Y=J.webgpu.adapter;if(Y){if(typeof Y.limits!="object"||typeof Y.features!="object"||typeof Y.requestDevice!="function")throw Error("Invalid GPU adapter set in `env.webgpu.adapter`. It must be a GPUAdapter object.")}else{let H=J.webgpu.powerPreference;if(H!==void 0&&H!=="low-power"&&H!=="high-performance")throw Error(`Invalid powerPreference setting: "${H}"`);let W=J.webgpu.forceFallbackAdapter;if(W!==void 0&&typeof W!="boolean")throw Error(`Invalid forceFallbackAdapter setting: "${W}"`);if(Y=await navigator.gpu.requestAdapter({powerPreference:H,forceFallbackAdapter:W}),!Y)throw Error('Failed to get GPU adapter. You may need to enable flag "--enable-unsafe-webgpu" if you are using Chrome.')}await X("webgpu",F1(),J,Y)}if(Q==="webnn"){if(typeof navigator>"u"||!navigator.ml)throw Error("WebNN is not supported in current environment");await X("webnn",F1(),J)}}},p6=new Map,jj=(J)=>{let Q=F1(),X=Q.stackSave();try{let Y=Q.PTR_SIZE,H=Q.stackAlloc(2*Y);Q._OrtGetInputOutputCount(J,H,H+Y)!==0&&m0("Can't get session input/output count.");let W=Y===4?"i32":"i64";return[Number(Q.getValue(H,W)),Number(Q.getValue(H+Y,W))]}finally{Q.stackRestore(X)}},c5=(J)=>{let Q=F1(),X=Q._malloc(J.byteLength);if(X===0)throw Error(`Can't create a session. failed to allocate a buffer of size ${J.byteLength}.`);return Q.HEAPU8.set(J,X),[X,J.byteLength]},w3=async(J,Q)=>{let X,Y,H=F1();Array.isArray(J)?[X,Y]=J:J.buffer===H.HEAPU8.buffer?[X,Y]=[J.byteOffset,J.byteLength]:[X,Y]=c5(J);let W=0,G=0,j=0,N=[],V=[],L=[];try{if([G,N]=hj(Q),Q?.externalData&&H.mountExternalData){let D=[];for(let S of Q.externalData){let w=typeof S=="string"?S:S.path;D.push(K3(typeof S=="string"?S:S.data).then((k)=>{H.mountExternalData(w,k)}))}await Promise.all(D)}for(let D of Q?.executionProviders??[])if((typeof D=="string"?D:D.name)==="webnn"){if(H.shouldTransferToMLTensor=!1,typeof D!="string"){let S=D,w=S?.context,k=S?.gpuDevice,I=S?.deviceType,C=S?.powerPreference;w?H.currentContext=w:k?H.currentContext=await H.jsepCreateMLContext(k):H.currentContext=await H.jsepCreateMLContext({deviceType:I,powerPreference:C})}else H.currentContext=await H.jsepCreateMLContext();break}W=await H._OrtCreateSession(X,Y,G),W===0&&m0("Can't create a session."),H.jsepOnCreateSession?.(),H.currentContext&&(H.jsepRegisterMLContext(W,H.currentContext),H.currentContext=void 0,H.shouldTransferToMLTensor=!0);let[B,U]=jj(W),E=!!Q?.enableGraphCapture,R=[],A=[],P=[];for(let D=0;D<B;D++){let S=H._OrtGetInputName(W,D);S===0&&m0("Can't get an input name."),V.push(S),R.push(H.UTF8ToString(S))}for(let D=0;D<U;D++){let S=H._OrtGetOutputName(W,D);S===0&&m0("Can't get an output name."),L.push(S);let w=H.UTF8ToString(S);A.push(w);{if(E&&Q?.preferredOutputLocation===void 0){P.push("gpu-buffer");continue}let k=typeof Q?.preferredOutputLocation=="string"?Q.preferredOutputLocation:Q?.preferredOutputLocation?.[w]??"cpu";if(k!=="cpu"&&k!=="cpu-pinned"&&k!=="gpu-buffer"&&k!=="ml-tensor")throw Error(`Not supported preferred output location: ${k}.`);if(E&&k!=="gpu-buffer")throw Error(`Not supported preferred output location: ${k}. Only 'gpu-buffer' location is supported when enableGraphCapture is true.`);P.push(k)}}let z=null;return P.some((D)=>D==="gpu-buffer"||D==="ml-tensor")&&(j=H._OrtCreateBinding(W),j===0&&m0("Can't create IO binding."),z={handle:j,outputPreferredLocations:P,outputPreferredLocationsEncoded:P.map((D)=>pX(D))}),p6.set(W,[W,V,L,z,E,!1]),[W,R,A]}catch(B){throw V.forEach((U)=>H._OrtFree(U)),L.forEach((U)=>H._OrtFree(U)),j!==0&&H._OrtReleaseBinding(j)!==0&&m0("Can't release IO binding."),W!==0&&H._OrtReleaseSession(W)!==0&&m0("Can't release session."),B}finally{H._free(X),G!==0&&H._OrtReleaseSessionOptions(G)!==0&&m0("Can't release session options."),N.forEach((B)=>H._free(B)),H.unmountExternalData?.()}},k3=(J)=>{let Q=F1(),X=p6.get(J);if(!X)throw Error(`cannot release session. invalid session id: ${J}`);let[Y,H,W,G,j]=X;G&&(j&&Q._OrtClearBoundOutputs(G.handle)!==0&&m0("Can't clear bound outputs."),Q._OrtReleaseBinding(G.handle)!==0&&m0("Can't release IO binding.")),Q.jsepOnReleaseSession?.(J),H.forEach((N)=>Q._OrtFree(N)),W.forEach((N)=>Q._OrtFree(N)),Q._OrtReleaseSession(Y)!==0&&m0("Can't release session."),p6.delete(J)},gX=async(J,Q,X,Y,H,W=!1)=>{if(!J){Q.push(0);return}let G=F1(),j=G.PTR_SIZE,N=J[0],V=J[1],L=J[3],B=L,U,E;if(N==="string"&&(L==="gpu-buffer"||L==="ml-tensor"))throw Error("String tensor is not supported on GPU.");if(W&&L!=="gpu-buffer")throw Error(`External buffer must be provided for input/output index ${H} when enableGraphCapture is true.`);if(L==="gpu-buffer"){let P=J[2].gpuBuffer;E=w8(t8(N),V);let z=G.jsepRegisterBuffer;if(!z)throw Error('Tensor location "gpu-buffer" is not supported without using WebGPU.');U=z(Y,H,P,E)}else if(L==="ml-tensor"){let P=J[2].mlTensor;E=w8(t8(N),V);let z=G.jsepRegisterMLTensor;if(!z)throw Error('Tensor location "ml-tensor" is not supported without using WebNN.');U=z(Y,P,t8(N),V)}else{let P=J[2];if(Array.isArray(P)){E=j*P.length,U=G._malloc(E),X.push(U);for(let z=0;z<P.length;z++){if(typeof P[z]!="string")throw TypeError(`tensor data at index ${z} is not a string`);G.setValue(U+z*j,D1(P[z],X),"*")}}else{let z=G.jsepIsGraphInput;if(N!=="string"&&z){let D=G._OrtGetInputName(Y,H),S=G.UTF8ToString(D);if(z(Y,S)){let w=t8(N);E=w8(w,V),B="ml-tensor";let{jsepCreateTemporaryTensor:k,jsepUploadTensor:I}=G;if(!k||!I)throw Error('Tensor location "ml-tensor" is not supported without using WebNN.');let C=await k(Y,w,V);I(C,new Uint8Array(P.buffer,P.byteOffset,P.byteLength)),U=C}else E=P.byteLength,U=G._malloc(E),X.push(U),G.HEAPU8.set(new Uint8Array(P.buffer,P.byteOffset,E),U)}else E=P.byteLength,U=G._malloc(E),X.push(U),G.HEAPU8.set(new Uint8Array(P.buffer,P.byteOffset,E),U)}}let R=G.stackSave(),A=G.stackAlloc(4*V.length);try{V.forEach((z,D)=>G.setValue(A+D*j,z,j===4?"i32":"i64"));let P=G._OrtCreateTensor(t8(N),U,E,A,V.length,pX(B));P===0&&m0(`Can't create tensor for input/output. session=${Y}, index=${H}.`),Q.push(P)}finally{G.stackRestore(R)}},C3=async(J,Q,X,Y,H,W)=>{let G=F1(),j=G.PTR_SIZE,N=p6.get(J);if(!N)throw Error(`cannot run inference. invalid session id: ${J}`);let V=N[0],L=N[1],B=N[2],U=N[3],E=N[4],R=N[5],A=Q.length,P=Y.length,z=0,D=[],S=[],w=[],k=[],I=G.stackSave(),C=G.stackAlloc(A*j),T=G.stackAlloc(A*j),g=G.stackAlloc(P*j),m=G.stackAlloc(P*j);try{[z,D]=fj(W);for(let h=0;h<A;h++)await gX(X[h],S,k,J,Q[h],E);for(let h=0;h<P;h++)await gX(H[h],w,k,J,A+Y[h],E);for(let h=0;h<A;h++)G.setValue(C+h*j,S[h],"*"),G.setValue(T+h*j,L[Q[h]],"*");for(let h=0;h<P;h++)G.setValue(g+h*j,w[h],"*"),G.setValue(m+h*j,B[Y[h]],"*");if(U&&!R){let{handle:h,outputPreferredLocations:W0,outputPreferredLocationsEncoded:j0}=U;if(L.length!==A)throw Error(`input count from feeds (${A}) is expected to be always equal to model's input count (${L.length}).`);for(let o=0;o<A;o++){let G0=Q[o];await G._OrtBindInput(h,L[G0],S[o])!==0&&m0(`Can't bind input[${o}] for session=${J}.`)}for(let o=0;o<P;o++){let G0=Y[o];H[o]?.[3]?G._OrtBindOutput(h,B[G0],w[o],0)!==0&&m0(`Can't bind pre-allocated output[${o}] for session=${J}.`):G._OrtBindOutput(h,B[G0],0,j0[G0])!==0&&m0(`Can't bind output[${o}] to ${W0[o]} for session=${J}.`)}p6.set(J,[V,L,B,U,E,!0])}G.jsepOnRunStart?.(V);let l;U?l=await G._OrtRunWithBinding(V,U.handle,P,g,z):l=await G._OrtRun(V,T,C,A,m,P,g,z),l!==0&&m0("failed to call OrtRun().");let t=[];for(let h=0;h<P;h++){let W0=Number(G.getValue(g+h*j,"*"));if(W0===w[h]){t.push(H[h]);continue}let j0=G.stackSave(),o=G.stackAlloc(4*j),G0=!1,F0,s=0;try{G._OrtGetTensorData(W0,o,o+j,o+2*j,o+3*j)!==0&&m0(`Can't access output tensor data on index ${h}.`);let N0=j===4?"i32":"i64",f=Number(G.getValue(o,N0));s=G.getValue(o+j,"*");let p=G.getValue(o+j*2,"*"),v=Number(G.getValue(o+j*3,N0)),r=[];for(let h0=0;h0<v;h0++)r.push(Number(G.getValue(p+h0*j,N0)));G._OrtFree(p)!==0&&m0("Can't free memory for tensor dims.");let k0=r.reduce((h0,_0)=>h0*_0,1);F0=Z8(f);let o0=U?.outputPreferredLocations[Y[h]];if(F0==="string"){if(o0==="gpu-buffer"||o0==="ml-tensor")throw Error("String tensor is not supported on GPU.");let h0=[];for(let _0=0;_0<k0;_0++){let q1=G.getValue(s+_0*j,"*"),u0=G.getValue(s+(_0+1)*j,"*"),D6=_0===k0-1?void 0:u0-q1;h0.push(G.UTF8ToString(q1,D6))}t.push([F0,r,h0,"cpu"])}else if(o0==="gpu-buffer"&&k0>0){let h0=G.jsepGetBuffer;if(!h0)throw Error('preferredLocation "gpu-buffer" is not supported without using WebGPU.');let _0=h0(s),q1=w8(f,k0);if(q1===void 0||!N3(F0))throw Error(`Unsupported data type: ${F0}`);G0=!0,t.push([F0,r,{gpuBuffer:_0,download:G.jsepCreateDownloader(_0,q1,F0),dispose:()=>{G._OrtReleaseTensor(W0)!==0&&m0("Can't release tensor.")}},"gpu-buffer"])}else if(o0==="ml-tensor"&&k0>0){let h0=G.jsepEnsureTensor;if(!h0)throw Error('preferredLocation "ml-tensor" is not supported without using WebNN.');if(w8(f,k0)===void 0||!V3(F0))throw Error(`Unsupported data type: ${F0}`);let _0=await h0(J,s,f,r,!1);G0=!0,t.push([F0,r,{mlTensor:_0,download:G.jsepCreateMLTensorDownloader(s,F0),dispose:()=>{G.jsepReleaseTensorId(s),G._OrtReleaseTensor(W0)}},"ml-tensor"])}else{let h0=F3(F0),_0=new h0(k0);new Uint8Array(_0.buffer,_0.byteOffset,_0.byteLength).set(G.HEAPU8.subarray(s,s+_0.byteLength)),t.push([F0,r,_0,"cpu"])}}finally{G.stackRestore(j0),F0==="string"&&s&&G._free(s),G0||G._OrtReleaseTensor(W0),G.jsepOnRunEnd?.(V)}}return U&&!E&&(G._OrtClearBoundOutputs(U.handle)!==0&&m0("Can't clear bound outputs."),p6.set(J,[V,L,B,U,E,!1])),t}finally{G.stackRestore(I),S.forEach((l)=>G._OrtReleaseTensor(l)),w.forEach((l)=>G._OrtReleaseTensor(l)),k.forEach((l)=>G._free(l)),z!==0&&G._OrtReleaseRunOptions(z),D.forEach((l)=>G._free(l))}},I3=(J)=>{let Q=F1(),X=p6.get(J);if(!X)throw Error("invalid session id");let Y=X[0],H=Q._OrtEndProfiling(Y);H===0&&m0("Can't get an profile file name."),Q._OrtFree(H)},_3=(J)=>{let Q=[];for(let X of J){let Y=X[2];!Array.isArray(Y)&&"buffer"in Y&&Q.push(Y.buffer)}return Q}}),lV=J0(()=>{q6(),bV(),b8(),W3(),c6=()=>!!a0.wasm.proxy&&typeof document<"u",r8=!1,C2=!1,I2=!1,x5=new Map,$8=(J,Q)=>{let X=x5.get(J);X?X.push(Q):x5.set(J,[Q])},P8=()=>{if(r8||!C2||I2||!g1)throw Error("worker not ready")},Fj=(J)=>{switch(J.data.type){case"init-wasm":r8=!1,J.data.err?(I2=!0,lX[1](J.data.err)):(C2=!0,lX[0]()),T5&&(URL.revokeObjectURL(T5),T5=void 0);break;case"init-ep":case"copy-from":case"create":case"release":case"run":case"end-profiling":{let Q=x5.get(J.data.type);J.data.err?Q.shift()[1](J.data.err):Q.shift()[0](J.data.out);break}default:}},vV=async()=>{if(!C2){if(r8)throw Error("multiple calls to 'initWasm()' detected.");if(I2)throw Error("previous call to 'initWasm()' failed.");if(r8=!0,c6())return new Promise((J,Q)=>{g1?.terminate(),Tj().then(([X,Y])=>{try{g1=Y,g1.onerror=(W)=>Q(W),g1.onmessage=Fj,lX=[J,Q];let H={type:"init-wasm",in:a0};!H.in.wasm.wasmPaths&&(X||import.meta.url?.startsWith("file:"))&&(H.in.wasm.wasmPaths={wasm:new URL("ort-wasm-simd-threaded.jsep.wasm",import.meta.url).href}),g1.postMessage(H),T5=X}catch(H){Q(H)}},Q)});try{await G3(a0.wasm),await S3(a0),C2=!0}catch(J){throw I2=!0,J}finally{r8=!1}}},TV=async(J)=>{if(c6())return P8(),new Promise((Q,X)=>{$8("init-ep",[Q,X]);let Y={type:"init-ep",in:{epName:J,env:a0}};g1.postMessage(Y)});await Z3(a0,J)},xV=async(J)=>c6()?(P8(),new Promise((Q,X)=>{$8("copy-from",[Q,X]);let Y={type:"copy-from",in:{buffer:J}};g1.postMessage(Y,[J.buffer])})):c5(J),fV=async(J,Q)=>{if(c6()){if(Q?.preferredOutputLocation)throw Error('session option "preferredOutputLocation" is not supported for proxy.');return P8(),new Promise((X,Y)=>{$8("create",[X,Y]);let H={type:"create",in:{model:J,options:{...Q}}},W=[];J instanceof Uint8Array&&W.push(J.buffer),g1.postMessage(H,W)})}else return w3(J,Q)},hV=async(J)=>{if(c6())return P8(),new Promise((Q,X)=>{$8("release",[Q,X]);let Y={type:"release",in:J};g1.postMessage(Y)});k3(J)},yV=async(J,Q,X,Y,H,W)=>{if(c6()){if(X.some((G)=>G[3]!=="cpu"))throw Error("input tensor on GPU is not supported for proxy.");if(H.some((G)=>G))throw Error("pre-allocated output tensor is not supported for proxy.");return P8(),new Promise((G,j)=>{$8("run",[G,j]);let N=X,V={type:"run",in:{sessionId:J,inputIndices:Q,inputs:N,outputIndices:Y,options:W}};g1.postMessage(V,_3(N))})}else return C3(J,Q,X,Y,H,W)},gV=async(J)=>{if(c6())return P8(),new Promise((Q,X)=>{$8("end-profiling",[Q,X]);let Y={type:"end-profiling",in:J};g1.postMessage(Y)});I3(J)}}),YA=J0(()=>{q6(),lV(),A0(),q3(),yj(),mX=(J,Q)=>{switch(J.location){case"cpu":return[J.type,J.dims,J.data,"cpu"];case"gpu-buffer":return[J.type,J.dims,{gpuBuffer:J.gpuBuffer},"gpu-buffer"];case"ml-tensor":return[J.type,J.dims,{mlTensor:J.mlTensor},"ml-tensor"];default:throw Error(`invalid data location: ${J.location} for ${Q()}`)}},Nj=(J)=>{switch(J[3]){case"cpu":return new Y6(J[0],J[2],J[1]);case"gpu-buffer":{let Q=J[0];if(!N3(Q))throw Error(`not supported data type: ${Q} for deserializing GPU tensor`);let{gpuBuffer:X,download:Y,dispose:H}=J[2];return Y6.fromGpuBuffer(X,{dataType:Q,dims:J[1],download:Y,dispose:H})}case"ml-tensor":{let Q=J[0];if(!V3(Q))throw Error(`not supported data type: ${Q} for deserializing MLTensor tensor`);let{mlTensor:X,download:Y,dispose:H}=J[2];return Y6.fromMLTensor(X,{dataType:Q,dims:J[1],download:Y,dispose:H})}default:throw Error(`invalid data location: ${J[3]}`)}},mV=class{async fetchModelAndCopyToWasmMemory(J){return xV(await K3(J))}async loadModel(J,Q){H6();let X;typeof J=="string"?X=await this.fetchModelAndCopyToWasmMemory(J):X=J,[this.sessionId,this.inputNames,this.outputNames]=await fV(X,Q),m1()}async dispose(){return hV(this.sessionId)}async run(J,Q,X){H6();let Y=[],H=[];Object.entries(J).forEach((B)=>{let U=B[0],E=B[1],R=this.inputNames.indexOf(U);if(R===-1)throw Error(`invalid input '${U}'`);Y.push(E),H.push(R)});let W=[],G=[];Object.entries(Q).forEach((B)=>{let U=B[0],E=B[1],R=this.outputNames.indexOf(U);if(R===-1)throw Error(`invalid output '${U}'`);W.push(E),G.push(R)});let j=Y.map((B,U)=>mX(B,()=>`input "${this.inputNames[H[U]]}"`)),N=W.map((B,U)=>B?mX(B,()=>`output "${this.outputNames[G[U]]}"`):null),V=await yV(this.sessionId,H,j,G,N,X),L={};for(let B=0;B<V.length;B++)L[this.outputNames[G[B]]]=W[B]??Nj(V[B]);return m1(),L}startProfiling(){}endProfiling(){gV(this.sessionId)}}}),pV={};h2(pV,{OnnxruntimeWebAssemblyBackend:()=>Q3,initializeFlags:()=>J3,wasmBackend:()=>cV});HA=J0(()=>{q6(),lV(),YA(),J3=()=>{if((typeof a0.wasm.initTimeout!="number"||a0.wasm.initTimeout<0)&&(a0.wasm.initTimeout=0),a0.wasm.simd===!1&&console.warn('Deprecated property "env.wasm.simd" is set to false. non-SIMD build is no longer provided, and this setting will be ignored.'),typeof a0.wasm.proxy!="boolean"&&(a0.wasm.proxy=!1),typeof a0.wasm.trace!="boolean"&&(a0.wasm.trace=!1),typeof a0.wasm.numThreads!="number"||!Number.isInteger(a0.wasm.numThreads)||a0.wasm.numThreads<=0)if(typeof self<"u"&&!self.crossOriginIsolated)a0.wasm.numThreads=1;else{let J=typeof navigator>"u"?cE("node:os").cpus().length:navigator.hardwareConcurrency;a0.wasm.numThreads=Math.min(4,Math.ceil((J||1)/2))}},Q3=class{async init(J){J3(),await vV(),await TV(J)}async createInferenceSessionHandler(J,Q){let X=new mV;return await X.loadModel(J,Q),Promise.resolve(X)}},cV=new Q3});q6();q6();q6();WA=kj;{let J=(HA(),h5(pV)).wasmBackend;k8("webgpu",J,5),k8("webnn",J,5),k8("cpu",J,10),k8("wasm",J,10)}Object.defineProperty(a0.versions,"web",{value:qA,enumerable:!0})});var YE={};oQ(YE,{registerBackend:()=>m8,env:()=>i0,default:()=>wz,Tensor:()=>V6,TRACE_FUNC_END:()=>d1,TRACE_FUNC_BEGIN:()=>K6,TRACE:()=>r2,InferenceSession:()=>cY});var mY,GA,jA,FA,NA,Q0=(J,Q)=>()=>(J&&(Q=J(J=0)),Q),e2=(J,Q)=>{for(var X in Q)mY(J,X,{get:Q[X],enumerable:!0})},VA=(J,Q,X,Y)=>{if(Q&&typeof Q=="object"||typeof Q=="function")for(let H of jA(Q))!FA.call(J,H)&&H!==X&&mY(J,H,{get:()=>Q[H],enumerable:!(Y=GA(Q,H))||Y.enumerable});return J},q4=(J)=>VA(mY({},"__esModule",{value:!0}),J),y2,o6,m8,oV,PL,SL,KA,ZL,MA,b3,c1,wL,i0,BA,kL,CL,LA,d5,IL,_L,bL,vL,TL,UA,y8,s2,v3,xL,OA,fL,hL,RA,h1,pY,V6,yL,r2,T3,K6,d1,gL,lL,EA,cY,DA,AA,zA,$A,PA,mL,M6,dY,pL,x3,f3,cL,SA,dL,h3,y3,uL,sV,ZA,g3,aV,f1,oL,u5,iV,nV,l3,rV,m3,sL,p3,aL,uY,c3,o5,g2,d3,tV,eV,oY,V1,u8,A1,W4,p0,sY,iL,wA,JK,QK,XK,YK,nL,kA,Y7,g8,l8,aY,G4,iY,nY,wY,z0,rY,rL,HK,qK,WK,GK,tY,jK,f0,h6,eY,tL,JH,u3,s5,a5,FK,NK,o3,kY,VK,eL,CA,KK,d0,Q1,MK,q7,u,j4,JU,QU,XU,w0,W7,i5,K1,P1,R0,e0,CY,H7,i6,U0,l2,i,B0,YU,QH,BK,HU,I0,LK,s3,UK,OK,RK,EK,y1,qU,WU,n6,DK,AK,zK,$K,PK,SK,ZK,wK,kK,CK,W6,GU,jU,FU,NU,VU,KU,MU,BU,LU,UU,IA,G6,IK,F4,IY,j6,_K,bK,vK,TK,xK,fK,hK,yK,gK,lK,F6,OU,RU,EU,DU,AU,zU,$U,PU,SU,ZU,XH,a3,wU,kU,_Y,_A,mK,n5,pK,cK,dK,t2,uK,CU,YH,oK,sK,aK,IU,bA,iK,nK,_U,vA,rK,g0,bU,vU,TU,xU,fU,hU,yU,gU,lU,tK,mU,pU,cU,dU,a2,uU,H4,oU,sU,aU,iU,nU,rU,tU,eU,JO,QO,XO,YO,HO,qO,WO,GO,i3,jO,bY,vY,FO,NO,VO,eK,JM,KO,HH,QM,XM,MO,TA,YM,HM,N6,BO,LO,UO,OO,RO,EO,DO,AO,zO,$O,xA,qM,WM,GM,jM,PO,SO,fA,p8,c8,d8,qH,o8,B1,ZO,WH,wO,hA,n2,GH,jH,FM,NM,TY,n3,VM,xY,KM,N4,FH,MM,kO,yA,BM,r3,m2,LM,t3,UM,CO,IO,gA,_O,bO,lA,OM,r5,RM,t5,fY,e3,EM,DM,hY,mA,vO,pA,AM,zM,$M,JY,TO,PM,QY,SM,xO,cA,ZM,fO,hO,dA,wM,kM,CM,yO,gO,uA,e5,p2,XY,IM,_M,bM,vM,YY,TM,lO,mO,oA,xM,HY,fM,hM,pO,sA,yM,cO,aA,gM,lM,dO,uO,iA,mM,oO,sO,nA,pM,cM,aO,iO,rA,dM,uM,nO,rO,tA,oM,sM,tO,eO,eA,O6,f6,T8,x8,aM,iM,nM,rM,tM,eM,JB,QB,JR,QR,Jz,w1,XB,XR,qY,YB,i2,YR,HR,HB,qB,WB,GB,yY,qR,WR,GR,jB,FB,WY,jR,Qz,GY,NB,VB,FR,Xz,KB,MB,NR,Yz,BB,VR,Hz,LB,UB,OB,KR,MR,qz,RB,EB,DB,AB,zB,$B,PB,SB,BR,Wz,c2,jY,FY,NY,VY,ZB,wB,KY,MY,LR,UR,BY,OR,RR,LY,ER,DR,AR,zR,Gz,kB,CB,$R,PR,jz,IB,_B,SR,Fz,bB,vB,ZR,wR,Nz,TB,xB,fB,UY,hB,yB,gB,lB,mB,pB,cB,dB,OY,uB,oB,sB,aB,iB,kR,CR,Vz,nB,rB,IR,Kz,tB,eB,_R,Mz,JL,d2,QL,RY,XL,YL,bR,vR,Bz,HL,qL,TR,xR,Lz,EY,WL,GL,jL,fR,Uz,FL,NL,hR,Oz,yR,Rz,gR,Ez,VL,KL,ML,BL,lR,Dz,LL,DY,UL,AY,zY,$Y,OL,mR,Az,J4,RL,pR,zz,cR,Q4,EL,dR,$z,DL,NH,VH,s6,AL,V4,KH,MH,PY,BH,LH,UH,uR,a6,p1,X7,u2,o2,X4,SY,Y4,f8,h8,zL,oR,sR,aR,iR,nR,rR,tR,eR,ZY,$L,JE,Pz,QE,gY,lY,XE,Sz,Zz="1.21.0",wz;var HE=bH(()=>{/*!
 * ONNX Runtime Web v1.21.0
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */mY=Object.defineProperty,GA=Object.getOwnPropertyDescriptor,jA=Object.getOwnPropertyNames,FA=Object.prototype.hasOwnProperty,NA=((J)=>n8)(function(J){return n8.apply(this,arguments)}),SL=Q0(()=>{y2=new Map,o6=[],m8=(J,Q,X)=>{if(Q&&typeof Q.init=="function"&&typeof Q.createInferenceSessionHandler=="function"){let Y=y2.get(J);if(Y===void 0)y2.set(J,{backend:Q,priority:X});else{if(Y.priority>X)return;if(Y.priority===X&&Y.backend!==Q)throw Error(`cannot register backend "${J}" using priority ${X}`)}if(X>=0){let H=o6.indexOf(J);H!==-1&&o6.splice(H,1);for(let W=0;W<o6.length;W++)if(y2.get(o6[W]).priority<=X){o6.splice(W,0,J);return}o6.push(J)}return}throw TypeError("not a valid backend")},oV=async(J)=>{let Q=y2.get(J);if(!Q)return"backend not found.";if(Q.initialized)return Q.backend;if(Q.aborted)return Q.error;{let X=!!Q.initPromise;try{return X||(Q.initPromise=Q.backend.init(J)),await Q.initPromise,Q.initialized=!0,Q.backend}catch(Y){return X||(Q.error=`${Y}`,Q.aborted=!0),Q.error}finally{delete Q.initPromise}}},PL=async(J)=>{let Q=J.executionProviders||[],X=Q.map((N)=>typeof N=="string"?N:N.name),Y=X.length===0?o6:X,H,W=[],G=new Set;for(let N of Y){let V=await oV(N);typeof V=="string"?W.push({name:N,err:V}):(H||(H=V),H===V&&G.add(N))}if(!H)throw Error(`no available backend found. ERR: ${W.map((N)=>`[${N.name}] ${N.err}`).join(", ")}`);for(let{name:N,err:V}of W)X.includes(N)&&console.warn(`removing requested execution provider "${N}" from session options because it is not available: ${V}`);let j=Q.filter((N)=>G.has(typeof N=="string"?N:N.name));return[H,new Proxy(J,{get:(N,V)=>V==="executionProviders"?j:Reflect.get(N,V)})]}}),KA=Q0(()=>{SL()}),MA=Q0(()=>{ZL="1.21.0"}),wL=Q0(()=>{MA(),b3="warning",c1={wasm:{},webgl:{},webgpu:{},versions:{common:ZL},set logLevel(J){if(J!==void 0){if(typeof J!="string"||["verbose","info","warning","error","fatal"].indexOf(J)===-1)throw Error(`Unsupported logging level: ${J}`);b3=J}},get logLevel(){return b3}},Object.defineProperty(c1,"logLevel",{enumerable:!0})}),BA=Q0(()=>{wL(),i0=c1}),LA=Q0(()=>{kL=(J,Q)=>{let X=typeof document<"u"?document.createElement("canvas"):new OffscreenCanvas(1,1);X.width=J.dims[3],X.height=J.dims[2];let Y=X.getContext("2d");if(Y!=null){let H,W;Q?.tensorLayout!==void 0&&Q.tensorLayout==="NHWC"?(H=J.dims[2],W=J.dims[3]):(H=J.dims[3],W=J.dims[2]);let G=Q?.format!==void 0?Q.format:"RGB",j=Q?.norm,N,V;j===void 0||j.mean===void 0?N=[255,255,255,255]:typeof j.mean=="number"?N=[j.mean,j.mean,j.mean,j.mean]:(N=[j.mean[0],j.mean[1],j.mean[2],0],j.mean[3]!==void 0&&(N[3]=j.mean[3])),j===void 0||j.bias===void 0?V=[0,0,0,0]:typeof j.bias=="number"?V=[j.bias,j.bias,j.bias,j.bias]:(V=[j.bias[0],j.bias[1],j.bias[2],0],j.bias[3]!==void 0&&(V[3]=j.bias[3]));let L=W*H,B=0,U=L,E=L*2,R=-1;G==="RGBA"?(B=0,U=L,E=L*2,R=L*3):G==="RGB"?(B=0,U=L,E=L*2):G==="RBG"&&(B=0,E=L,U=L*2);for(let A=0;A<W;A++)for(let P=0;P<H;P++){let z=(J.data[B++]-V[0])*N[0],D=(J.data[U++]-V[1])*N[1],S=(J.data[E++]-V[2])*N[2],w=R===-1?255:(J.data[R++]-V[3])*N[3];Y.fillStyle="rgba("+z+","+D+","+S+","+w+")",Y.fillRect(P,A,1,1)}if("toDataURL"in X)return X.toDataURL();throw Error("toDataURL is not supported")}else throw Error("Can not access image data")},CL=(J,Q)=>{let X=typeof document<"u"?document.createElement("canvas").getContext("2d"):new OffscreenCanvas(1,1).getContext("2d"),Y;if(X!=null){let H,W,G;Q?.tensorLayout!==void 0&&Q.tensorLayout==="NHWC"?(H=J.dims[2],W=J.dims[1],G=J.dims[3]):(H=J.dims[3],W=J.dims[2],G=J.dims[1]);let j=Q!==void 0&&Q.format!==void 0?Q.format:"RGB",N=Q?.norm,V,L;N===void 0||N.mean===void 0?V=[255,255,255,255]:typeof N.mean=="number"?V=[N.mean,N.mean,N.mean,N.mean]:(V=[N.mean[0],N.mean[1],N.mean[2],255],N.mean[3]!==void 0&&(V[3]=N.mean[3])),N===void 0||N.bias===void 0?L=[0,0,0,0]:typeof N.bias=="number"?L=[N.bias,N.bias,N.bias,N.bias]:(L=[N.bias[0],N.bias[1],N.bias[2],0],N.bias[3]!==void 0&&(L[3]=N.bias[3]));let B=W*H;if(Q!==void 0&&(Q.format!==void 0&&G===4&&Q.format!=="RGBA"||G===3&&Q.format!=="RGB"&&Q.format!=="BGR"))throw Error("Tensor format doesn't match input tensor dims");let U=4,E=0,R=1,A=2,P=3,z=0,D=B,S=B*2,w=-1;j==="RGBA"?(z=0,D=B,S=B*2,w=B*3):j==="RGB"?(z=0,D=B,S=B*2):j==="RBG"&&(z=0,S=B,D=B*2),Y=X.createImageData(H,W);for(let k=0;k<W*H;E+=U,R+=U,A+=U,P+=U,k++)Y.data[E]=(J.data[z++]-L[0])*V[0],Y.data[R]=(J.data[D++]-L[1])*V[1],Y.data[A]=(J.data[S++]-L[2])*V[2],Y.data[P]=w===-1?255:(J.data[w++]-L[3])*V[3]}else throw Error("Can not access image data");return Y}}),UA=Q0(()=>{pY(),d5=(J,Q)=>{if(J===void 0)throw Error("Image buffer must be defined");if(Q.height===void 0||Q.width===void 0)throw Error("Image height and width must be defined");if(Q.tensorLayout==="NHWC")throw Error("NHWC Tensor layout is not supported yet");let{height:X,width:Y}=Q,H=Q.norm??{mean:255,bias:0},W,G;typeof H.mean=="number"?W=[H.mean,H.mean,H.mean,H.mean]:W=[H.mean[0],H.mean[1],H.mean[2],H.mean[3]??255],typeof H.bias=="number"?G=[H.bias,H.bias,H.bias,H.bias]:G=[H.bias[0],H.bias[1],H.bias[2],H.bias[3]??0];let j=Q.format!==void 0?Q.format:"RGBA",N=Q.tensorFormat!==void 0&&Q.tensorFormat!==void 0?Q.tensorFormat:"RGB",V=X*Y,L=N==="RGBA"?new Float32Array(V*4):new Float32Array(V*3),B=4,U=0,E=1,R=2,A=3,P=0,z=V,D=V*2,S=-1;j==="RGB"&&(B=3,U=0,E=1,R=2,A=-1),N==="RGBA"?S=V*3:N==="RBG"?(P=0,D=V,z=V*2):N==="BGR"&&(D=0,z=V,P=V*2);for(let w=0;w<V;w++,U+=B,R+=B,E+=B,A+=B)L[P++]=(J[U]+G[0])/W[0],L[z++]=(J[E]+G[1])/W[1],L[D++]=(J[R]+G[2])/W[2],S!==-1&&A!==-1&&(L[S++]=(J[A]+G[3])/W[3]);return N==="RGBA"?new h1("float32",L,[1,4,X,Y]):new h1("float32",L,[1,3,X,Y])},IL=async(J,Q)=>{let X=typeof HTMLImageElement<"u"&&J instanceof HTMLImageElement,Y=typeof ImageData<"u"&&J instanceof ImageData,H=typeof ImageBitmap<"u"&&J instanceof ImageBitmap,W=typeof J=="string",G,j=Q??{},N=()=>{if(typeof document<"u")return document.createElement("canvas");if(typeof OffscreenCanvas<"u")return new OffscreenCanvas(1,1);throw Error("Canvas is not supported")},V=(L)=>typeof HTMLCanvasElement<"u"&&L instanceof HTMLCanvasElement||L instanceof OffscreenCanvas?L.getContext("2d"):null;if(X){let L=N();L.width=J.width,L.height=J.height;let B=V(L);if(B!=null){let{height:U,width:E}=J;if(Q!==void 0&&Q.resizedHeight!==void 0&&Q.resizedWidth!==void 0&&(U=Q.resizedHeight,E=Q.resizedWidth),Q!==void 0){if(j=Q,Q.tensorFormat!==void 0)throw Error("Image input config format must be RGBA for HTMLImageElement");j.tensorFormat="RGBA",j.height=U,j.width=E}else j.tensorFormat="RGBA",j.height=U,j.width=E;B.drawImage(J,0,0),G=B.getImageData(0,0,E,U).data}else throw Error("Can not access image data")}else if(Y){let L,B;if(Q!==void 0&&Q.resizedWidth!==void 0&&Q.resizedHeight!==void 0?(L=Q.resizedHeight,B=Q.resizedWidth):(L=J.height,B=J.width),Q!==void 0&&(j=Q),j.format="RGBA",j.height=L,j.width=B,Q!==void 0){let U=N();U.width=B,U.height=L;let E=V(U);if(E!=null)E.putImageData(J,0,0),G=E.getImageData(0,0,B,L).data;else throw Error("Can not access image data")}else G=J.data}else if(H){if(Q===void 0)throw Error("Please provide image config with format for Imagebitmap");let L=N();L.width=J.width,L.height=J.height;let B=V(L);if(B!=null){let{height:U,width:E}=J;return B.drawImage(J,0,0,E,U),G=B.getImageData(0,0,E,U).data,j.height=U,j.width=E,d5(G,j)}else throw Error("Can not access image data")}else{if(W)return new Promise((L,B)=>{let U=N(),E=V(U);if(!J||!E)return B();let R=new Image;R.crossOrigin="Anonymous",R.src=J,R.onload=()=>{U.width=R.width,U.height=R.height,E.drawImage(R,0,0,U.width,U.height);let A=E.getImageData(0,0,U.width,U.height);j.height=U.height,j.width=U.width,L(d5(A.data,j))}});throw Error("Input data provided is not supported - aborted tensor creation")}if(G!==void 0)return d5(G,j);throw Error("Input data provided is not supported - aborted tensor creation")},_L=(J,Q)=>{let{width:X,height:Y,download:H,dispose:W}=Q;return new h1({location:"texture",type:"float32",texture:J,dims:[1,Y,X,4],download:H,dispose:W})},bL=(J,Q)=>{let{dataType:X,dims:Y,download:H,dispose:W}=Q;return new h1({location:"gpu-buffer",type:X??"float32",gpuBuffer:J,dims:Y,download:H,dispose:W})},vL=(J,Q)=>{let{dataType:X,dims:Y,download:H,dispose:W}=Q;return new h1({location:"ml-tensor",type:X??"float32",mlTensor:J,dims:Y,download:H,dispose:W})},TL=(J,Q,X)=>new h1({location:"cpu-pinned",type:J,data:Q,dims:X??[Q.length]})}),OA=Q0(()=>{y8=new Map([["float32",Float32Array],["uint8",Uint8Array],["int8",Int8Array],["uint16",Uint16Array],["int16",Int16Array],["int32",Int32Array],["bool",Uint8Array],["float64",Float64Array],["uint32",Uint32Array],["int4",Uint8Array],["uint4",Uint8Array]]),s2=new Map([[Float32Array,"float32"],[Uint8Array,"uint8"],[Int8Array,"int8"],[Uint16Array,"uint16"],[Int16Array,"int16"],[Int32Array,"int32"],[Float64Array,"float64"],[Uint32Array,"uint32"]]),v3=!1,xL=()=>{if(!v3){v3=!0;let J=typeof BigInt64Array<"u"&&BigInt64Array.from,Q=typeof BigUint64Array<"u"&&BigUint64Array.from,X=globalThis.Float16Array,Y=typeof X<"u"&&X.from;J&&(y8.set("int64",BigInt64Array),s2.set(BigInt64Array,"int64")),Q&&(y8.set("uint64",BigUint64Array),s2.set(BigUint64Array,"uint64")),Y?(y8.set("float16",X),s2.set(X,"float16")):y8.set("float16",Uint16Array)}}}),RA=Q0(()=>{pY(),fL=(J)=>{let Q=1;for(let X=0;X<J.length;X++){let Y=J[X];if(typeof Y!="number"||!Number.isSafeInteger(Y))throw TypeError(`dims[${X}] must be an integer, got: ${Y}`);if(Y<0)throw RangeError(`dims[${X}] must be a non-negative integer, got: ${Y}`);Q*=Y}return Q},hL=(J,Q)=>{switch(J.location){case"cpu":return new h1(J.type,J.data,Q);case"cpu-pinned":return new h1({location:"cpu-pinned",data:J.data,type:J.type,dims:Q});case"texture":return new h1({location:"texture",texture:J.texture,type:J.type,dims:Q});case"gpu-buffer":return new h1({location:"gpu-buffer",gpuBuffer:J.gpuBuffer,type:J.type,dims:Q});case"ml-tensor":return new h1({location:"ml-tensor",mlTensor:J.mlTensor,type:J.type,dims:Q});default:throw Error(`tensorReshape: tensor location ${J.location} is not supported`)}}}),pY=Q0(()=>{LA(),UA(),OA(),RA(),h1=class{constructor(J,Q,X){xL();let Y,H;if(typeof J=="object"&&"location"in J)switch(this.dataLocation=J.location,Y=J.type,H=J.dims,J.location){case"cpu-pinned":{let G=y8.get(Y);if(!G)throw TypeError(`unsupported type "${Y}" to create tensor from pinned buffer`);if(!(J.data instanceof G))throw TypeError(`buffer should be of type ${G.name}`);this.cpuData=J.data;break}case"texture":{if(Y!=="float32")throw TypeError(`unsupported type "${Y}" to create tensor from texture`);this.gpuTextureData=J.texture,this.downloader=J.download,this.disposer=J.dispose;break}case"gpu-buffer":{if(Y!=="float32"&&Y!=="float16"&&Y!=="int32"&&Y!=="int64"&&Y!=="uint32"&&Y!=="uint8"&&Y!=="bool"&&Y!=="uint4"&&Y!=="int4")throw TypeError(`unsupported type "${Y}" to create tensor from gpu buffer`);this.gpuBufferData=J.gpuBuffer,this.downloader=J.download,this.disposer=J.dispose;break}case"ml-tensor":{if(Y!=="float32"&&Y!=="float16"&&Y!=="int32"&&Y!=="int64"&&Y!=="uint32"&&Y!=="uint64"&&Y!=="int8"&&Y!=="uint8"&&Y!=="bool"&&Y!=="uint4"&&Y!=="int4")throw TypeError(`unsupported type "${Y}" to create tensor from MLTensor`);this.mlTensorData=J.mlTensor,this.downloader=J.download,this.disposer=J.dispose;break}default:throw Error(`Tensor constructor: unsupported location '${this.dataLocation}'`)}else{let G,j;if(typeof J=="string")if(Y=J,j=X,J==="string"){if(!Array.isArray(Q))throw TypeError("A string tensor's data must be a string array.");G=Q}else{let N=y8.get(J);if(N===void 0)throw TypeError(`Unsupported tensor type: ${J}.`);if(Array.isArray(Q)){if(J==="float16"&&N===Uint16Array||J==="uint4"||J==="int4")throw TypeError(`Creating a ${J} tensor from number array is not supported. Please use ${N.name} as data.`);J==="uint64"||J==="int64"?G=N.from(Q,BigInt):G=N.from(Q)}else if(Q instanceof N)G=Q;else if(Q instanceof Uint8ClampedArray)if(J==="uint8")G=Uint8Array.from(Q);else throw TypeError("A Uint8ClampedArray tensor's data must be type of uint8");else if(J==="float16"&&Q instanceof Uint16Array&&N!==Uint16Array)G=new globalThis.Float16Array(Q.buffer,Q.byteOffset,Q.length);else throw TypeError(`A ${Y} tensor's data must be type of ${N}`)}else if(j=Q,Array.isArray(J)){if(J.length===0)throw TypeError("Tensor type cannot be inferred from an empty array.");let N=typeof J[0];if(N==="string")Y="string",G=J;else if(N==="boolean")Y="bool",G=Uint8Array.from(J);else throw TypeError(`Invalid element type of data array: ${N}.`)}else if(J instanceof Uint8ClampedArray)Y="uint8",G=Uint8Array.from(J);else{let N=s2.get(J.constructor);if(N===void 0)throw TypeError(`Unsupported type for tensor data: ${J.constructor}.`);Y=N,G=J}if(j===void 0)j=[G.length];else if(!Array.isArray(j))throw TypeError("A tensor's dims must be a number array");H=j,this.cpuData=G,this.dataLocation="cpu"}let W=fL(H);if(this.cpuData&&W!==this.cpuData.length&&!((Y==="uint4"||Y==="int4")&&Math.ceil(W/2)===this.cpuData.length))throw Error(`Tensor's size(${W}) does not match data length(${this.cpuData.length}).`);this.type=Y,this.dims=H,this.size=W}static async fromImage(J,Q){return IL(J,Q)}static fromTexture(J,Q){return _L(J,Q)}static fromGpuBuffer(J,Q){return bL(J,Q)}static fromMLTensor(J,Q){return vL(J,Q)}static fromPinnedBuffer(J,Q,X){return TL(J,Q,X)}toDataURL(J){return kL(this,J)}toImageData(J){return CL(this,J)}get data(){if(this.ensureValid(),!this.cpuData)throw Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");return this.cpuData}get location(){return this.dataLocation}get texture(){if(this.ensureValid(),!this.gpuTextureData)throw Error("The data is not stored as a WebGL texture.");return this.gpuTextureData}get gpuBuffer(){if(this.ensureValid(),!this.gpuBufferData)throw Error("The data is not stored as a WebGPU buffer.");return this.gpuBufferData}get mlTensor(){if(this.ensureValid(),!this.mlTensorData)throw Error("The data is not stored as a WebNN MLTensor.");return this.mlTensorData}async getData(J){switch(this.ensureValid(),this.dataLocation){case"cpu":case"cpu-pinned":return this.data;case"texture":case"gpu-buffer":case"ml-tensor":{if(!this.downloader)throw Error("The current tensor is not created with a specified data downloader.");if(this.isDownloading)throw Error("The current tensor is being downloaded.");try{this.isDownloading=!0;let Q=await this.downloader();return this.downloader=void 0,this.dataLocation="cpu",this.cpuData=Q,J&&this.disposer&&(this.disposer(),this.disposer=void 0),Q}finally{this.isDownloading=!1}}default:throw Error(`cannot get data from location: ${this.dataLocation}`)}}dispose(){if(this.isDownloading)throw Error("The current tensor is being downloaded.");this.disposer&&(this.disposer(),this.disposer=void 0),this.cpuData=void 0,this.gpuTextureData=void 0,this.gpuBufferData=void 0,this.mlTensorData=void 0,this.downloader=void 0,this.isDownloading=void 0,this.dataLocation="none"}ensureValid(){if(this.dataLocation==="none")throw Error("The tensor is disposed.")}reshape(J){if(this.ensureValid(),this.downloader||this.disposer)throw Error("Cannot reshape a tensor that owns GPU resource.");return hL(this,J)}}}),yL=Q0(()=>{pY(),V6=h1}),gL=Q0(()=>{wL(),r2=(J,Q)=>{(typeof c1.trace>"u"?!c1.wasm.trace:!c1.trace)||console.timeStamp(`${J}::ORT::${Q}`)},T3=(J,Q)=>{let X=Error().stack?.split(/\r\n|\r|\n/g)||[],Y=!1;for(let H=0;H<X.length;H++){if(Y&&!X[H].includes("TRACE_FUNC")){let W=`FUNC_${J}::${X[H].trim().split(" ")[1]}`;Q&&(W+=`::${Q}`),r2("CPU",W);return}X[H].includes("TRACE_FUNC")&&(Y=!0)}},K6=(J)=>{(typeof c1.trace>"u"?!c1.wasm.trace:!c1.trace)||T3("BEGIN",J)},d1=(J)=>{(typeof c1.trace>"u"?!c1.wasm.trace:!c1.trace)||T3("END",J)}}),EA=Q0(()=>{SL(),yL(),gL(),lL=class J{constructor(Q){this.handler=Q}async run(Q,X,Y){K6();let H={},W={};if(typeof Q!="object"||Q===null||Q instanceof V6||Array.isArray(Q))throw TypeError("'feeds' must be an object that use input names as keys and OnnxValue as corresponding values.");let G=!0;if(typeof X=="object"){if(X===null)throw TypeError("Unexpected argument[1]: cannot be null.");if(X instanceof V6)throw TypeError("'fetches' cannot be a Tensor");if(Array.isArray(X)){if(X.length===0)throw TypeError("'fetches' cannot be an empty array.");G=!1;for(let V of X){if(typeof V!="string")throw TypeError("'fetches' must be a string array or an object.");if(this.outputNames.indexOf(V)===-1)throw RangeError(`'fetches' contains invalid output name: ${V}.`);H[V]=null}if(typeof Y=="object"&&Y!==null)W=Y;else if(typeof Y<"u")throw TypeError("'options' must be an object.")}else{let V=!1,L=Object.getOwnPropertyNames(X);for(let B of this.outputNames)if(L.indexOf(B)!==-1){let U=X[B];(U===null||U instanceof V6)&&(V=!0,G=!1,H[B]=U)}if(V){if(typeof Y=="object"&&Y!==null)W=Y;else if(typeof Y<"u")throw TypeError("'options' must be an object.")}else W=X}}else if(typeof X<"u")throw TypeError("Unexpected argument[1]: must be 'fetches' or 'options'.");for(let V of this.inputNames)if(typeof Q[V]>"u")throw Error(`input '${V}' is missing in 'feeds'.`);if(G)for(let V of this.outputNames)H[V]=null;let j=await this.handler.run(Q,H,W),N={};for(let V in j)if(Object.hasOwnProperty.call(j,V)){let L=j[V];L instanceof V6?N[V]=L:N[V]=new V6(L.type,L.data,L.dims)}return d1(),N}async release(){return this.handler.dispose()}static async create(Q,X,Y,H){K6();let W,G={};if(typeof Q=="string"){if(W=Q,typeof X=="object"&&X!==null)G=X;else if(typeof X<"u")throw TypeError("'options' must be an object.")}else if(Q instanceof Uint8Array){if(W=Q,typeof X=="object"&&X!==null)G=X;else if(typeof X<"u")throw TypeError("'options' must be an object.")}else if(Q instanceof ArrayBuffer||typeof SharedArrayBuffer<"u"&&Q instanceof SharedArrayBuffer){let L=Q,B=0,U=Q.byteLength;if(typeof X=="object"&&X!==null)G=X;else if(typeof X=="number"){if(B=X,!Number.isSafeInteger(B))throw RangeError("'byteOffset' must be an integer.");if(B<0||B>=L.byteLength)throw RangeError(`'byteOffset' is out of range [0, ${L.byteLength}).`);if(U=Q.byteLength-B,typeof Y=="number"){if(U=Y,!Number.isSafeInteger(U))throw RangeError("'byteLength' must be an integer.");if(U<=0||B+U>L.byteLength)throw RangeError(`'byteLength' is out of range (0, ${L.byteLength-B}].`);if(typeof H=="object"&&H!==null)G=H;else if(typeof H<"u")throw TypeError("'options' must be an object.")}else if(typeof Y<"u")throw TypeError("'byteLength' must be a number.")}else if(typeof X<"u")throw TypeError("'options' must be an object.");W=new Uint8Array(L,B,U)}else throw TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");let[j,N]=await PL(G),V=await j.createInferenceSessionHandler(W,N);return d1(),new J(V)}startProfiling(){this.handler.startProfiling()}endProfiling(){this.handler.endProfiling()}get inputNames(){return this.handler.inputNames}get outputNames(){return this.handler.outputNames}}}),DA=Q0(()=>{EA(),cY=lL}),AA=Q0(()=>{}),zA=Q0(()=>{}),$A=Q0(()=>{}),PA=Q0(()=>{}),mL={};e2(mL,{InferenceSession:()=>cY,TRACE:()=>r2,TRACE_FUNC_BEGIN:()=>K6,TRACE_FUNC_END:()=>d1,Tensor:()=>V6,env:()=>i0,registerBackend:()=>m8});M6=Q0(()=>{KA(),BA(),DA(),yL(),AA(),zA(),gL(),$A(),PA()}),dY=Q0(()=>{}),pL={};e2(pL,{default:()=>cL});SA=Q0(()=>{uR(),u8(),uY(),x3="ort-wasm-proxy-worker",f3=globalThis.self?.name===x3,f3&&(self.onmessage=(J)=>{let{type:Q,in:X}=J.data;try{switch(Q){case"init-wasm":oY(X.wasm).then(()=>{NH(X).then(()=>{postMessage({type:Q})},(Y)=>{postMessage({type:Q,err:Y})})},(Y)=>{postMessage({type:Q,err:Y})});break;case"init-ep":{let{epName:Y,env:H}=X;VH(H,Y).then(()=>{postMessage({type:Q})},(W)=>{postMessage({type:Q,err:W})});break}case"copy-from":{let{buffer:Y}=X,H=V4(Y);postMessage({type:Q,out:H});break}case"create":{let{model:Y,options:H}=X;KH(Y,H).then((W)=>{postMessage({type:Q,out:W})},(W)=>{postMessage({type:Q,err:W})});break}case"release":MH(X),postMessage({type:Q});break;case"run":{let{sessionId:Y,inputIndices:H,inputs:W,outputIndices:G,options:j}=X;BH(Y,H,W,G,Array(G.length).fill(null),j).then((N)=>{N.some((V)=>V[3]!=="cpu")?postMessage({type:Q,err:"Proxy does not support non-cpu tensor location."}):postMessage({type:Q,out:N},UH([...W,...N]))},(N)=>{postMessage({type:Q,err:N})});break}case"end-profiling":LH(X),postMessage({type:Q});break;default:}}catch(Y){postMessage({type:Q,err:Y})}}),cL=f3?null:(J)=>new Worker(J??f1,{type:"module",name:x3})}),dL={};e2(dL,{default:()=>uL});ZA=Q0(()=>{y3=(h3=import.meta.url,async function(J={}){var Q,X,Y=J,H=new Promise((q,F)=>{Q=q,X=F}),W=typeof window=="object",G=typeof WorkerGlobalScope<"u",j=G&&self.name?.startsWith("em-pthread");Y.mountExternalData=(q,F)=>{q.startsWith("./")&&(q=q.substring(2)),(Y.Bd||(Y.Bd=new Map)).set(q,F)},Y.unmountExternalData=()=>{delete Y.Bd};var N=globalThis.SharedArrayBuffer??new WebAssembly.Memory({initial:0,maximum:0,shared:!0}).buffer.constructor;let V=()=>{let q=(K,M,O)=>(...$)=>{let Z=Y1,_=M?.();$=K(...$);let b=M?.();return _!==b&&(K=b,O(_),M=O=null),Y1!=Z?new Promise((y,c)=>{M8={resolve:y,reject:c}}):$},F=(K)=>async(...M)=>{try{if(Y.Cd)throw Error("Session already started");let O=Y.Cd={be:M[0],errors:[]},$=await K(...M);if(Y.Cd!==O)throw Error("Session mismatch");Y.Dd?.flush();let Z=O.errors;if(0<Z.length){let _=await Promise.all(Z);if(_=_.filter((b)=>b),0<_.length)throw Error(_.join(`
`))}return $}finally{Y.Cd=null}};Y._OrtCreateSession=q(Y._OrtCreateSession,()=>Y._OrtCreateSession,(K)=>Y._OrtCreateSession=K),Y._OrtRun=F(q(Y._OrtRun,()=>Y._OrtRun,(K)=>Y._OrtRun=K)),Y._OrtRunWithBinding=F(q(Y._OrtRunWithBinding,()=>Y._OrtRunWithBinding,(K)=>Y._OrtRunWithBinding=K)),Y._OrtBindInput=q(Y._OrtBindInput,()=>Y._OrtBindInput,(K)=>Y._OrtBindInput=K),V=void 0};Y.jsepInit=(q,F)=>{if(V?.(),q==="webgpu"){[Y.Dd,Y.Rd,Y.Vd,Y.Hd,Y.Ud,Y.hc,Y.Wd,Y.Zd,Y.Sd,Y.Td,Y.Xd]=F;let K=Y.Dd;Y.jsepRegisterBuffer=(M,O,$,Z)=>K.registerBuffer(M,O,$,Z),Y.jsepGetBuffer=(M)=>K.getBuffer(M),Y.jsepCreateDownloader=(M,O,$)=>K.createDownloader(M,O,$),Y.jsepOnCreateSession=(M)=>{K.onCreateSession(M)},Y.jsepOnReleaseSession=(M)=>{K.onReleaseSession(M)},Y.jsepOnRunStart=(M)=>K.onRunStart(M),Y.$d=(M,O)=>{K.upload(M,O)}}else if(q==="webnn"){[Y.Dd,Y.Yd,Y.Id,Y.jsepEnsureTensor,Y.Jd,Y.jsepDownloadTensor]=F,Y.jsepReleaseTensorId=Y.Id,Y.jsepUploadTensor=Y.Jd;let K=Y.Dd;Y.jsepOnRunStart=(M)=>K.onRunStart(M),Y.jsepOnRunEnd=K.onRunEnd.bind(K),Y.jsepRegisterMLContext=(M,O)=>{K.registerMLContext(M,O)},Y.jsepOnReleaseSession=(M)=>{K.onReleaseSession(M)},Y.jsepCreateMLTensorDownloader=(M,O)=>K.createMLTensorDownloader(M,O),Y.jsepRegisterMLTensor=(M,O,$,Z)=>K.registerMLTensor(M,O,$,Z),Y.jsepCreateMLContext=(M)=>K.createMLContext(M),Y.jsepRegisterMLConstant=(M,O,$,Z,_)=>K.registerMLConstant(M,O,$,Z,_,Y.Bd),Y.jsepRegisterGraphInput=K.registerGraphInput.bind(K),Y.jsepIsGraphInput=K.isGraphInput.bind(K),Y.jsepCreateTemporaryTensor=K.createTemporaryTensor.bind(K)}};var L,B,U=Object.assign({},Y),E=(q,F)=>{throw F},R="";(W||G)&&(G?R=self.location.href:typeof document<"u"&&document.currentScript&&(R=document.currentScript.src),h3&&(R=h3),R=R.startsWith("blob:")?"":R.slice(0,R.replace(/[?#].*/,"").lastIndexOf("/")+1),G&&(B=(q)=>{var F=new XMLHttpRequest;return F.open("GET",q,!1),F.responseType="arraybuffer",F.send(null),new Uint8Array(F.response)}),L=async(q)=>{if(F0(q))return new Promise((K,M)=>{var O=new XMLHttpRequest;O.open("GET",q,!0),O.responseType="arraybuffer",O.onload=()=>{O.status==200||O.status==0&&O.response?K(O.response):M(O.status)},O.onerror=M,O.send(null)});var F=await fetch(q,{credentials:"same-origin"});if(F.ok)return F.arrayBuffer();throw Error(F.status+" : "+F.url)});var A=console.log.bind(console),P=console.error.bind(console),z=A,D=P;Object.assign(Y,U),U=null;var S,w,k,I,C,T,g,m,l,t,h,W0,j0,o=Y.wasmBinary,G0=!1,F0=(q)=>q.startsWith("file://");function s(){return S.buffer!=I.buffer&&u0(),I}function N0(){return S.buffer!=I.buffer&&u0(),C}function f(){return S.buffer!=I.buffer&&u0(),T}function p(){return S.buffer!=I.buffer&&u0(),g}function v(){return S.buffer!=I.buffer&&u0(),m}function r(){return S.buffer!=I.buffer&&u0(),l}function k0(){return S.buffer!=I.buffer&&u0(),t}function o0(){return S.buffer!=I.buffer&&u0(),j0}if(j){let q=function(F){try{var K=F.data,M=K.yd;if(M==="load"){let O=[];self.onmessage=($)=>O.push($),self.startWorker=()=>{postMessage({yd:"loaded"});for(let $ of O)q($);self.onmessage=q};for(let $ of K.Od)Y[$]&&!Y[$].proxy||(Y[$]=(...Z)=>{postMessage({yd:"callHandler",Nd:$,args:Z})},$=="print"&&(z=Y[$]),$=="printErr"&&(D=Y[$]));S=K.he,u0(),_0(K.ie)}else if(M==="run"){I4(K.xd),O8(K.xd,0,0,1,0,0),$7(),V8(K.xd),q1||(O9(),q1=!0);try{_4(K.de,K.Fd)}catch(O){if(O!="unwind")throw O}}else K.target!=="setimmediate"&&(M==="checkMailbox"?q1&&P6():M&&(D(`worker: received unknown command ${M}`),D(K)))}catch(O){throw R9(),O}};var h0=q,_0,q1=!1;D=function(...F){F=F.join(" "),console.error(F)},self.alert=function(...F){postMessage({yd:"alert",text:F.join(" "),fe:b6()})},self.onunhandledrejection=(F)=>{throw F.reason||F},self.onmessage=q}function u0(){var q=S.buffer;Y.HEAP8=I=new Int8Array(q),Y.HEAP16=T=new Int16Array(q),Y.HEAPU8=C=new Uint8Array(q),Y.HEAPU16=g=new Uint16Array(q),Y.HEAP32=m=new Int32Array(q),Y.HEAPU32=l=new Uint32Array(q),Y.HEAPF32=t=new Float32Array(q),Y.HEAPF64=j0=new Float64Array(q),Y.HEAP64=h=new BigInt64Array(q),Y.HEAPU64=W0=new BigUint64Array(q)}function D6(){j?startWorker(Y):x.Bb()}j||(S=new WebAssembly.Memory({initial:256,maximum:65536,shared:!0}),u0());var e6,o1=0,s1=null;function U7(){if(--o1==0&&s1){var q=s1;s1=null,q()}}function W1(q){throw D(q="Aborted("+q+")"),G0=!0,q=new WebAssembly.RuntimeError(q+". Build with -sASSERTIONS for more info."),X(q),q}function O7(){return{a:{Ta:C4,Va:k4,W:b4,la:v4,b:x4,u:f4,R:h4,Za:y4,d:g4,pb:w7,g:T4,T:I7,Ga:_7,lb:v7,nb:T7,Ha:x7,Ea:f7,wb:h7,Da:y7,pa:g7,mb:l7,jb:m7,Fa:p7,kb:c7,Ma:l4,za:p4,eb:c4,cb:u4,ya:s4,V:a4,N:i4,db:n4,ma:YJ,fb:HJ,zb:qJ,hb:WJ,qb:GJ,ab:jJ,Aa:FJ,yb:V8,Ja:NJ,S:VJ,Wa:KJ,$:LJ,G:UJ,E:RJ,m:j8,H:EJ,B:zJ,X:$J,J:PJ,v:SJ,O:ZJ,D:wJ,t:kJ,A:CJ,z:IJ,w:_J,r:bJ,tb:vJ,ub:TJ,vb:xJ,rb:Y9,sb:H9,bb:q9,Oa:hJ,La:lJ,y:mJ,ja:pJ,Ba:cJ,Ka:yJ,qa:dJ,Ia:uJ,ib:oJ,U:fJ,fa:sJ,Sa:aJ,gb:iJ,Qa:nJ,Pa:rJ,Ab:F9,Ca:N9,ob:Y8,aa:V9,oa:K9,xb:M9,na:B9,$a:PQ,ia:hQ,sa:pQ,ga:zQ,da:IQ,ua:lQ,p:DQ,e:HQ,c:XQ,ea:kQ,f:qQ,n:GQ,k:UQ,Y:FQ,ka:OQ,j:AQ,wa:wQ,Ra:uQ,ca:xQ,Ua:dQ,P:CQ,K:VQ,_:TQ,Q:$Q,Z:yQ,x:NQ,l:YQ,va:vQ,i:QQ,h:jQ,ra:cQ,ta:mQ,o:WQ,q:KQ,s:BQ,I:LQ,C:EQ,L:RQ,xa:ZQ,_a:SQ,F:fQ,Ya:_Q,ba:gQ,M:MQ,Xa:bQ,ha:eJ,a:S,Na:X8}}}var J8={1319426:()=>typeof wasmOffsetConverter<"u",1319483:(q,F,K,M,O)=>{if(Y===void 0||!Y.Bd)return 1;if((q=b0(Number(q>>>0))).startsWith("./")&&(q=q.substring(2)),!(q=Y.Bd.get(q)))return 2;if(F=Number(F>>>0),K=Number(K>>>0),M=Number(M>>>0),F+K>q.byteLength)return 3;try{let $=q.subarray(F,F+K);switch(O){case 0:N0().set($,M>>>0);break;case 1:Y.$d(M,$);break;default:return 4}return 0}catch{return 4}},1320198:(q,F,K)=>{Y.Jd(q,N0().subarray(F>>>0,F+K>>>0))},1320261:()=>Y.Yd(),1320302:(q)=>{Y.Id(q)},1320338:()=>{Y.Sd()},1320369:()=>{Y.Td()},1320398:()=>{Y.Xd()},1320423:(q)=>Y.Rd(q),1320456:(q)=>Y.Vd(q),1320488:(q,F,K)=>{Y.Hd(Number(q),Number(F),Number(K),!0)},1320551:(q,F,K)=>{Y.Hd(Number(q),Number(F),Number(K))},1320608:(q)=>{Y.hc("Abs",q,void 0)},1320659:(q)=>{Y.hc("Neg",q,void 0)},1320710:(q)=>{Y.hc("Floor",q,void 0)},1320763:(q)=>{Y.hc("Ceil",q,void 0)},1320815:(q)=>{Y.hc("Reciprocal",q,void 0)},1320873:(q)=>{Y.hc("Sqrt",q,void 0)},1320925:(q)=>{Y.hc("Exp",q,void 0)},1320976:(q)=>{Y.hc("Erf",q,void 0)},1321027:(q)=>{Y.hc("Sigmoid",q,void 0)},1321082:(q,F,K)=>{Y.hc("HardSigmoid",q,{alpha:F,beta:K})},1321161:(q)=>{Y.hc("Log",q,void 0)},1321212:(q)=>{Y.hc("Sin",q,void 0)},1321263:(q)=>{Y.hc("Cos",q,void 0)},1321314:(q)=>{Y.hc("Tan",q,void 0)},1321365:(q)=>{Y.hc("Asin",q,void 0)},1321417:(q)=>{Y.hc("Acos",q,void 0)},1321469:(q)=>{Y.hc("Atan",q,void 0)},1321521:(q)=>{Y.hc("Sinh",q,void 0)},1321573:(q)=>{Y.hc("Cosh",q,void 0)},1321625:(q)=>{Y.hc("Asinh",q,void 0)},1321678:(q)=>{Y.hc("Acosh",q,void 0)},1321731:(q)=>{Y.hc("Atanh",q,void 0)},1321784:(q)=>{Y.hc("Tanh",q,void 0)},1321836:(q)=>{Y.hc("Not",q,void 0)},1321887:(q,F,K)=>{Y.hc("Clip",q,{min:F,max:K})},1321956:(q)=>{Y.hc("Clip",q,void 0)},1322008:(q,F)=>{Y.hc("Elu",q,{alpha:F})},1322066:(q)=>{Y.hc("Gelu",q,void 0)},1322118:(q)=>{Y.hc("Relu",q,void 0)},1322170:(q,F)=>{Y.hc("LeakyRelu",q,{alpha:F})},1322234:(q,F)=>{Y.hc("ThresholdedRelu",q,{alpha:F})},1322304:(q,F)=>{Y.hc("Cast",q,{to:F})},1322362:(q)=>{Y.hc("Add",q,void 0)},1322413:(q)=>{Y.hc("Sub",q,void 0)},1322464:(q)=>{Y.hc("Mul",q,void 0)},1322515:(q)=>{Y.hc("Div",q,void 0)},1322566:(q)=>{Y.hc("Pow",q,void 0)},1322617:(q)=>{Y.hc("Equal",q,void 0)},1322670:(q)=>{Y.hc("Greater",q,void 0)},1322725:(q)=>{Y.hc("GreaterOrEqual",q,void 0)},1322787:(q)=>{Y.hc("Less",q,void 0)},1322839:(q)=>{Y.hc("LessOrEqual",q,void 0)},1322898:(q,F,K,M,O)=>{Y.hc("ReduceMean",q,{keepDims:!!F,noopWithEmptyAxes:!!K,axes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1323073:(q,F,K,M,O)=>{Y.hc("ReduceMax",q,{keepDims:!!F,noopWithEmptyAxes:!!K,axes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1323247:(q,F,K,M,O)=>{Y.hc("ReduceMin",q,{keepDims:!!F,noopWithEmptyAxes:!!K,axes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1323421:(q,F,K,M,O)=>{Y.hc("ReduceProd",q,{keepDims:!!F,noopWithEmptyAxes:!!K,axes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1323596:(q,F,K,M,O)=>{Y.hc("ReduceSum",q,{keepDims:!!F,noopWithEmptyAxes:!!K,axes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1323770:(q,F,K,M,O)=>{Y.hc("ReduceL1",q,{keepDims:!!F,noopWithEmptyAxes:!!K,axes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1323943:(q,F,K,M,O)=>{Y.hc("ReduceL2",q,{keepDims:!!F,noopWithEmptyAxes:!!K,axes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1324116:(q,F,K,M,O)=>{Y.hc("ReduceLogSum",q,{keepDims:!!F,noopWithEmptyAxes:!!K,axes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1324293:(q,F,K,M,O)=>{Y.hc("ReduceSumSquare",q,{keepDims:!!F,noopWithEmptyAxes:!!K,axes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1324473:(q,F,K,M,O)=>{Y.hc("ReduceLogSumExp",q,{keepDims:!!F,noopWithEmptyAxes:!!K,axes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1324653:(q)=>{Y.hc("Where",q,void 0)},1324706:(q,F,K)=>{Y.hc("Transpose",q,{perm:F?Array.from(v().subarray(Number(F)>>>0,Number(K)>>>0)):[]})},1324830:(q,F,K,M)=>{Y.hc("DepthToSpace",q,{blocksize:F,mode:b0(K),format:M?"NHWC":"NCHW"})},1324963:(q,F,K,M)=>{Y.hc("DepthToSpace",q,{blocksize:F,mode:b0(K),format:M?"NHWC":"NCHW"})},1325096:(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0,r0)=>{Y.hc("ConvTranspose",q,{format:b?"NHWC":"NCHW",autoPad:F,dilations:[K],group:M,kernelShape:[O],pads:[$,Z],strides:[_],wIsConst:()=>!!s()[y>>>0],outputPadding:c?Array.from(v().subarray(Number(c)>>>0,Number(n)>>>0)):[],outputShape:H0?Array.from(v().subarray(Number(H0)>>>0,Number(D0)>>>0)):[],activation:b0(r0)})},1325529:(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0)=>{Y.hc("ConvTranspose",q,{format:_?"NHWC":"NCHW",autoPad:F,dilations:Array.from(v().subarray(Number(K)>>>0,2+(Number(K)>>>0)>>>0)),group:M,kernelShape:Array.from(v().subarray(Number(O)>>>0,2+(Number(O)>>>0)>>>0)),pads:Array.from(v().subarray(Number($)>>>0,4+(Number($)>>>0)>>>0)),strides:Array.from(v().subarray(Number(Z)>>>0,2+(Number(Z)>>>0)>>>0)),wIsConst:()=>!!s()[b>>>0],outputPadding:y?Array.from(v().subarray(Number(y)>>>0,Number(c)>>>0)):[],outputShape:n?Array.from(v().subarray(Number(n)>>>0,Number(H0)>>>0)):[],activation:b0(D0)})},1326190:(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0,r0)=>{Y.hc("ConvTranspose",q,{format:b?"NHWC":"NCHW",autoPad:F,dilations:[K],group:M,kernelShape:[O],pads:[$,Z],strides:[_],wIsConst:()=>!!s()[y>>>0],outputPadding:c?Array.from(v().subarray(Number(c)>>>0,Number(n)>>>0)):[],outputShape:H0?Array.from(v().subarray(Number(H0)>>>0,Number(D0)>>>0)):[],activation:b0(r0)})},1326623:(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0)=>{Y.hc("ConvTranspose",q,{format:_?"NHWC":"NCHW",autoPad:F,dilations:Array.from(v().subarray(Number(K)>>>0,2+(Number(K)>>>0)>>>0)),group:M,kernelShape:Array.from(v().subarray(Number(O)>>>0,2+(Number(O)>>>0)>>>0)),pads:Array.from(v().subarray(Number($)>>>0,4+(Number($)>>>0)>>>0)),strides:Array.from(v().subarray(Number(Z)>>>0,2+(Number(Z)>>>0)>>>0)),wIsConst:()=>!!s()[b>>>0],outputPadding:y?Array.from(v().subarray(Number(y)>>>0,Number(c)>>>0)):[],outputShape:n?Array.from(v().subarray(Number(n)>>>0,Number(H0)>>>0)):[],activation:b0(D0)})},1327284:(q,F)=>{Y.hc("GlobalAveragePool",q,{format:F?"NHWC":"NCHW"})},1327375:(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0)=>{Y.hc("AveragePool",q,{format:D0?"NHWC":"NCHW",auto_pad:F,ceil_mode:K,count_include_pad:M,storage_order:O,dilations:$?Array.from(v().subarray(Number($)>>>0,Number(Z)>>>0)):[],kernel_shape:_?Array.from(v().subarray(Number(_)>>>0,Number(b)>>>0)):[],pads:y?Array.from(v().subarray(Number(y)>>>0,Number(c)>>>0)):[],strides:n?Array.from(v().subarray(Number(n)>>>0,Number(H0)>>>0)):[]})},1327854:(q,F)=>{Y.hc("GlobalAveragePool",q,{format:F?"NHWC":"NCHW"})},1327945:(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0)=>{Y.hc("AveragePool",q,{format:D0?"NHWC":"NCHW",auto_pad:F,ceil_mode:K,count_include_pad:M,storage_order:O,dilations:$?Array.from(v().subarray(Number($)>>>0,Number(Z)>>>0)):[],kernel_shape:_?Array.from(v().subarray(Number(_)>>>0,Number(b)>>>0)):[],pads:y?Array.from(v().subarray(Number(y)>>>0,Number(c)>>>0)):[],strides:n?Array.from(v().subarray(Number(n)>>>0,Number(H0)>>>0)):[]})},1328424:(q,F)=>{Y.hc("GlobalMaxPool",q,{format:F?"NHWC":"NCHW"})},1328511:(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0)=>{Y.hc("MaxPool",q,{format:D0?"NHWC":"NCHW",auto_pad:F,ceil_mode:K,count_include_pad:M,storage_order:O,dilations:$?Array.from(v().subarray(Number($)>>>0,Number(Z)>>>0)):[],kernel_shape:_?Array.from(v().subarray(Number(_)>>>0,Number(b)>>>0)):[],pads:y?Array.from(v().subarray(Number(y)>>>0,Number(c)>>>0)):[],strides:n?Array.from(v().subarray(Number(n)>>>0,Number(H0)>>>0)):[]})},1328986:(q,F)=>{Y.hc("GlobalMaxPool",q,{format:F?"NHWC":"NCHW"})},1329073:(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0)=>{Y.hc("MaxPool",q,{format:D0?"NHWC":"NCHW",auto_pad:F,ceil_mode:K,count_include_pad:M,storage_order:O,dilations:$?Array.from(v().subarray(Number($)>>>0,Number(Z)>>>0)):[],kernel_shape:_?Array.from(v().subarray(Number(_)>>>0,Number(b)>>>0)):[],pads:y?Array.from(v().subarray(Number(y)>>>0,Number(c)>>>0)):[],strides:n?Array.from(v().subarray(Number(n)>>>0,Number(H0)>>>0)):[]})},1329548:(q,F,K,M,O)=>{Y.hc("Gemm",q,{alpha:F,beta:K,transA:M,transB:O})},1329652:(q)=>{Y.hc("MatMul",q,void 0)},1329706:(q,F,K,M)=>{Y.hc("ArgMax",q,{keepDims:!!F,selectLastIndex:!!K,axis:M})},1329814:(q,F,K,M)=>{Y.hc("ArgMin",q,{keepDims:!!F,selectLastIndex:!!K,axis:M})},1329922:(q,F)=>{Y.hc("Softmax",q,{axis:F})},1329985:(q,F)=>{Y.hc("Concat",q,{axis:F})},1330045:(q,F,K,M,O)=>{Y.hc("Split",q,{axis:F,numOutputs:K,splitSizes:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1330201:(q)=>{Y.hc("Expand",q,void 0)},1330255:(q,F)=>{Y.hc("Gather",q,{axis:Number(F)})},1330326:(q,F)=>{Y.hc("GatherElements",q,{axis:Number(F)})},1330405:(q,F)=>{Y.hc("GatherND",q,{batch_dims:Number(F)})},1330484:(q,F,K,M,O,$,Z,_,b,y,c)=>{Y.hc("Resize",q,{antialias:F,axes:K?Array.from(v().subarray(Number(K)>>>0,Number(M)>>>0)):[],coordinateTransformMode:b0(O),cubicCoeffA:$,excludeOutside:Z,extrapolationValue:_,keepAspectRatioPolicy:b0(b),mode:b0(y),nearestMode:b0(c)})},1330846:(q,F,K,M,O,$,Z)=>{Y.hc("Slice",q,{starts:F?Array.from(v().subarray(Number(F)>>>0,Number(K)>>>0)):[],ends:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[],axes:$?Array.from(v().subarray(Number($)>>>0,Number(Z)>>>0)):[]})},1331110:(q)=>{Y.hc("Tile",q,void 0)},1331162:(q,F,K)=>{Y.hc("InstanceNormalization",q,{epsilon:F,format:K?"NHWC":"NCHW"})},1331276:(q,F,K)=>{Y.hc("InstanceNormalization",q,{epsilon:F,format:K?"NHWC":"NCHW"})},1331390:(q)=>{Y.hc("Range",q,void 0)},1331443:(q,F)=>{Y.hc("Einsum",q,{equation:b0(F)})},1331524:(q,F,K,M,O)=>{Y.hc("Pad",q,{mode:F,value:K,pads:M?Array.from(v().subarray(Number(M)>>>0,Number(O)>>>0)):[]})},1331667:(q,F,K,M,O,$)=>{Y.hc("BatchNormalization",q,{epsilon:F,momentum:K,spatial:!!O,trainingMode:!!M,format:$?"NHWC":"NCHW"})},1331836:(q,F,K,M,O,$)=>{Y.hc("BatchNormalization",q,{epsilon:F,momentum:K,spatial:!!O,trainingMode:!!M,format:$?"NHWC":"NCHW"})},1332005:(q,F,K)=>{Y.hc("CumSum",q,{exclusive:Number(F),reverse:Number(K)})},1332102:(q,F,K)=>{Y.hc("DequantizeLinear",q,{axis:F,blockSize:K})},1332192:(q,F,K,M,O)=>{Y.hc("GridSample",q,{align_corners:F,mode:b0(K),padding_mode:b0(M),format:O?"NHWC":"NCHW"})},1332362:(q,F,K,M,O)=>{Y.hc("GridSample",q,{align_corners:F,mode:b0(K),padding_mode:b0(M),format:O?"NHWC":"NCHW"})},1332532:(q,F)=>{Y.hc("ScatterND",q,{reduction:b0(F)})},1332617:(q,F,K,M,O,$,Z,_,b)=>{Y.hc("Attention",q,{numHeads:F,isUnidirectional:K,maskFilterValue:M,scale:O,doRotary:$,qkvHiddenSizes:Z?Array.from(v().subarray(Number(_)>>>0,Number(_)+Z>>>0)):[],pastPresentShareBuffer:!!b})},1332889:(q)=>{Y.hc("BiasAdd",q,void 0)},1332944:(q)=>{Y.hc("BiasSplitGelu",q,void 0)},1333005:(q)=>{Y.hc("FastGelu",q,void 0)},1333061:(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0,r0,r1)=>{Y.hc("Conv",q,{format:n?"NHWC":"NCHW",auto_pad:F,dilations:K?Array.from(v().subarray(Number(K)>>>0,Number(M)>>>0)):[],group:O,kernel_shape:$?Array.from(v().subarray(Number($)>>>0,Number(Z)>>>0)):[],pads:_?Array.from(v().subarray(Number(_)>>>0,Number(b)>>>0)):[],strides:y?Array.from(v().subarray(Number(y)>>>0,Number(c)>>>0)):[],w_is_const:()=>!!s()[Number(H0)>>>0],activation:b0(D0),activation_params:r0?Array.from(k0().subarray(Number(r0)>>>0,Number(r1)>>>0)):[]})},1333645:(q)=>{Y.hc("Gelu",q,void 0)},1333697:(q,F,K,M,O,$,Z,_,b)=>{Y.hc("GroupQueryAttention",q,{numHeads:F,kvNumHeads:K,scale:M,softcap:O,doRotary:$,rotaryInterleaved:Z,smoothSoftmax:_,localWindowSize:b})},1333914:(q,F,K,M)=>{Y.hc("LayerNormalization",q,{axis:F,epsilon:K,simplified:!!M})},1334025:(q,F,K,M)=>{Y.hc("LayerNormalization",q,{axis:F,epsilon:K,simplified:!!M})},1334136:(q,F,K,M,O,$)=>{Y.hc("MatMulNBits",q,{k:F,n:K,accuracyLevel:M,bits:O,blockSize:$})},1334263:(q,F,K,M,O,$)=>{Y.hc("MultiHeadAttention",q,{numHeads:F,isUnidirectional:K,maskFilterValue:M,scale:O,doRotary:$})},1334422:(q,F)=>{Y.hc("QuickGelu",q,{alpha:F})},1334486:(q,F,K,M,O)=>{Y.hc("RotaryEmbedding",q,{interleaved:!!F,numHeads:K,rotaryEmbeddingDim:M,scale:O})},1334625:(q,F,K)=>{Y.hc("SkipLayerNormalization",q,{epsilon:F,simplified:!!K})},1334727:(q,F,K)=>{Y.hc("SkipLayerNormalization",q,{epsilon:F,simplified:!!K})},1334829:(q,F,K,M)=>{Y.hc("GatherBlockQuantized",q,{gatherAxis:F,quantizeAxis:K,blockSize:M})},1334950:(q)=>{Y.Wd(q)},1334984:(q,F)=>Y.Zd(Number(q),Number(F),Y.Cd.be,Y.Cd.errors)};function k4(q,F,K){return r7(async()=>{await Y.Ud(Number(q),Number(F),Number(K))})}function C4(){return typeof wasmOffsetConverter<"u"}class A6{name="ExitStatus";constructor(q){this.message=`Program terminated with exit(${q})`,this.status=q}}var R7=(q)=>{q.terminate(),q.onmessage=()=>{}},Q8=[],E7=(q)=>{U1.length==0&&(S7(),P7(U1[0]));var F=U1.pop();if(!F)return 6;a1.push(F),S1[q.xd]=F,F.xd=q.xd;var K={yd:"run",de:q.ce,Fd:q.Fd,xd:q.xd};return F.postMessage(K,q.Ld),0},L1=0,$0=(q,F,...K)=>{for(var M=2*K.length,O=X0(),$=E8(8*M),Z=$>>>3,_=0;_<K.length;_++){var b=K[_];typeof b=="bigint"?(h[Z+2*_]=1n,h[Z+2*_+1]=b):(h[Z+2*_]=0n,o0()[Z+2*_+1>>>0]=b)}return q=E9(q,0,M,$,F),e(O),q};function X8(q){if(j)return $0(0,1,q);if(k=q,!(0<L1)){for(var F of a1)R7(F);for(F of U1)R7(F);U1=[],a1=[],S1={},G0=!0}E(0,new A6(q))}function D7(q){if(j)return $0(1,0,q);Y8(q)}var Y8=(q)=>{if(k=q,j)throw D7(q),"unwind";X8(q)},U1=[],a1=[],A7=[],S1={},z7=(q)=>{var F=q.xd;delete S1[F],U1.push(q),a1.splice(a1.indexOf(q),1),q.xd=0,D9(F)};function $7(){A7.forEach((q)=>q())}var P7=(q)=>new Promise((F)=>{q.onmessage=(O)=>{var $=(O=O.data).yd;if(O.Ed&&O.Ed!=b6()){var Z=S1[O.Ed];Z?Z.postMessage(O,O.Ld):D(`Internal error! Worker sent a message "${$}" to target pthread ${O.Ed}, but that thread no longer exists!`)}else $==="checkMailbox"?P6():$==="spawnThread"?E7(O):$==="cleanupThread"?z7(S1[O.ee]):$==="loaded"?(q.loaded=!0,F(q)):$==="alert"?alert(`Thread ${O.fe}: ${O.text}`):O.target==="setimmediate"?q.postMessage(O):$==="callHandler"?Y[O.Nd](...O.args):$&&D(`worker sent an unknown command ${$}`)},q.onerror=(O)=>{throw D(`worker sent an error! ${O.filename}:${O.lineno}: ${O.message}`),O};var K,M=[];for(K of[])Y.propertyIsEnumerable(K)&&M.push(K);q.postMessage({yd:"load",Od:M,he:S,ie:w})});function S7(){var q=new Worker(import.meta.url.startsWith("file:")?new URL("ort.bundle.min.mjs",import.meta.url):new URL(import.meta.url),{type:"module",workerData:"em-pthread",name:"em-pthread"});U1.push(q)}var I4=(q)=>{u0();var F=r()[q+52>>>2>>>0];q=r()[q+56>>>2>>>0],$9(F,F-q),e(F)},_4=(q,F)=>{L1=0,q=D8(q,F),0<L1?k=q:R8(q)},z6=[];function b4(q){var F=new $6(q>>>=0);if(s()[F.wd+12>>>0]==0){var K=1;s()[F.wd+12>>>0]=K}return K=0,s()[F.wd+13>>>0]=K,z6.push(F),S9(q),w9(q)}var I1=0,v4=()=>{Y0(0,0);var q=z6.pop();P9(q.Gd),I1=0};class $6{constructor(q){this.Gd=q,this.wd=q-24}}function T4(q){throw I1||=q>>>0,I1}var H8=(q)=>{var F=I1;if(!F)return n1(0),0;var K=new $6(F);r()[K.wd+16>>>2>>>0]=F;var M=r()[K.wd+4>>>2>>>0];if(!M)return n1(0),F;for(var O of q){if(O===0||O===M)break;if(Z9(O,M,K.wd+16))return n1(O),F}return n1(M),F};function x4(){return H8([])}function f4(q){return H8([q>>>0])}function h4(q,F){return H8([q>>>0,F>>>0])}var y4=()=>{var q=z6.pop();q||W1("no exception to throw");var F=q.Gd;if(s()[q.wd+13>>>0]==0){z6.push(q);var K=1;s()[q.wd+13>>>0]=K,K=0,s()[q.wd+12>>>0]=K}throw I1=F};function g4(q,F,K){var M=new $6(q>>>=0);throw F>>>=0,K>>>=0,r()[M.wd+16>>>2>>>0]=0,r()[M.wd+4>>>2>>>0]=F,r()[M.wd+8>>>2>>>0]=K,I1=q}function Z7(q,F,K,M){return j?$0(2,1,q,F,K,M):w7(q,F,K,M)}function w7(q,F,K,M){if(q>>>=0,K>>>=0,M>>>=0,N===void 0)return 6;var O=[];return j&&O.length===0?Z7(q,F>>>=0,K,M):(q={ce:K,xd:q,Fd:M,Ld:O},j?(q.yd="spawnThread",postMessage(q,O),0):E7(q))}var k7=typeof TextDecoder<"u"?new TextDecoder:void 0,C7=(q,F=0,K=NaN)=>{var M=(F>>>=0)+K;for(K=F;q[K]&&!(K>=M);)++K;if(16<K-F&&q.buffer&&k7)return k7.decode(q.buffer instanceof ArrayBuffer?q.subarray(F,K):q.slice(F,K));for(M="";F<K;){var O=q[F++];if(128&O){var $=63&q[F++];if((224&O)==192)M+=String.fromCharCode((31&O)<<6|$);else{var Z=63&q[F++];65536>(O=(240&O)==224?(15&O)<<12|$<<6|Z:(7&O)<<18|$<<12|Z<<6|63&q[F++])?M+=String.fromCharCode(O):(O-=65536,M+=String.fromCharCode(55296|O>>10,56320|1023&O))}}else M+=String.fromCharCode(O)}return M},b0=(q,F)=>(q>>>=0)?C7(N0(),q,F):"";function I7(q,F,K){return j?$0(3,1,q,F,K):0}function _7(q,F){if(j)return $0(4,1,q,F)}var b7=(q)=>{for(var F=0,K=0;K<q.length;++K){var M=q.charCodeAt(K);127>=M?F++:2047>=M?F+=2:55296<=M&&57343>=M?(F+=4,++K):F+=3}return F},_1=(q,F,K)=>{var M=N0();if(F>>>=0,0<K){var O=F;K=F+K-1;for(var $=0;$<q.length;++$){var Z=q.charCodeAt($);if(55296<=Z&&57343>=Z&&(Z=65536+((1023&Z)<<10)|1023&q.charCodeAt(++$)),127>=Z){if(F>=K)break;M[F++>>>0]=Z}else{if(2047>=Z){if(F+1>=K)break;M[F++>>>0]=192|Z>>6}else{if(65535>=Z){if(F+2>=K)break;M[F++>>>0]=224|Z>>12}else{if(F+3>=K)break;M[F++>>>0]=240|Z>>18,M[F++>>>0]=128|Z>>12&63}M[F++>>>0]=128|Z>>6&63}M[F++>>>0]=128|63&Z}}M[F>>>0]=0,q=F-O}else q=0;return q};function v7(q,F){if(j)return $0(5,1,q,F)}function T7(q,F,K){if(j)return $0(6,1,q,F,K)}function x7(q,F,K){return j?$0(7,1,q,F,K):0}function f7(q,F){if(j)return $0(8,1,q,F)}function h7(q,F,K){if(j)return $0(9,1,q,F,K)}function y7(q,F,K,M){if(j)return $0(10,1,q,F,K,M)}function g7(q,F,K,M){if(j)return $0(11,1,q,F,K,M)}function l7(q,F,K,M){if(j)return $0(12,1,q,F,K,M)}function m7(q){if(j)return $0(13,1,q)}function p7(q,F){if(j)return $0(14,1,q,F)}function c7(q,F,K){if(j)return $0(15,1,q,F,K)}var d7,O1,l4=()=>W1(""),X1=(q)=>{for(var F="";N0()[q>>>0];)F+=d7[N0()[q++>>>0]];return F},q8={},W8={},m4={};function G1(q,F,K={}){return function(M,O,$={}){var Z=O.name;if(!M)throw new O1(`type "${Z}" must have a positive integer typeid pointer`);if(W8.hasOwnProperty(M)){if($.Pd)return;throw new O1(`Cannot register type '${Z}' twice`)}W8[M]=O,delete m4[M],q8.hasOwnProperty(M)&&(O=q8[M],delete q8[M],O.forEach((_)=>_()))}(q,F,K)}var u7=(q,F,K)=>{switch(F){case 1:return K?(M)=>s()[M>>>0]:(M)=>N0()[M>>>0];case 2:return K?(M)=>f()[M>>>1>>>0]:(M)=>p()[M>>>1>>>0];case 4:return K?(M)=>v()[M>>>2>>>0]:(M)=>r()[M>>>2>>>0];case 8:return K?(M)=>h[M>>>3]:(M)=>W0[M>>>3];default:throw TypeError(`invalid integer width (${F}): ${q}`)}};function p4(q,F,K){K>>>=0,G1(q>>>=0,{name:F=X1(F>>>0),fromWireType:(M)=>M,toWireType:function(M,O){if(typeof O!="bigint"&&typeof O!="number")throw O=O===null?"null":(M=typeof O)=="object"||M==="array"||M==="function"?O.toString():""+O,TypeError(`Cannot convert "${O}" to ${this.name}`);return typeof O=="number"&&(O=BigInt(O)),O},zd:R1,readValueFromPointer:u7(F,K,F.indexOf("u")==-1),Ad:null})}var R1=8;function c4(q,F,K,M){G1(q>>>=0,{name:F=X1(F>>>0),fromWireType:function(O){return!!O},toWireType:function(O,$){return $?K:M},zd:R1,readValueFromPointer:function(O){return this.fromWireType(N0()[O>>>0])},Ad:null})}var G8=[],j1=[];function j8(q){9<(q>>>=0)&&--j1[q+1]==0&&(j1[q]=void 0,G8.push(q))}var s0=(q)=>{if(!q)throw new O1("Cannot use deleted val. handle = "+q);return j1[q]},n0=(q)=>{switch(q){case void 0:return 2;case null:return 4;case!0:return 6;case!1:return 8;default:let F=G8.pop()||j1.length;return j1[F]=q,j1[F+1]=1,F}};function F8(q){return this.fromWireType(r()[q>>>2>>>0])}var d4={name:"emscripten::val",fromWireType:(q)=>{var F=s0(q);return j8(q),F},toWireType:(q,F)=>n0(F),zd:R1,readValueFromPointer:F8,Ad:null};function u4(q){return G1(q>>>0,d4)}var o4=(q,F)=>{switch(F){case 4:return function(K){return this.fromWireType(k0()[K>>>2>>>0])};case 8:return function(K){return this.fromWireType(o0()[K>>>3>>>0])};default:throw TypeError(`invalid float width (${F}): ${q}`)}};function s4(q,F,K){K>>>=0,G1(q>>>=0,{name:F=X1(F>>>0),fromWireType:(M)=>M,toWireType:(M,O)=>O,zd:R1,readValueFromPointer:o4(F,K),Ad:null})}function a4(q,F,K,M,O){if(q>>>=0,K>>>=0,F=X1(F>>>0),O===-1&&(O=4294967295),O=(_)=>_,M===0){var $=32-8*K;O=(_)=>_<<$>>>$}var Z=F.includes("unsigned")?function(_,b){return b>>>0}:function(_,b){return b};G1(q,{name:F,fromWireType:O,toWireType:Z,zd:R1,readValueFromPointer:u7(F,K,M!==0),Ad:null})}function i4(q,F,K){function M($){var Z=r()[$>>>2>>>0];return $=r()[$+4>>>2>>>0],new O(s().buffer,$,Z)}var O=[Int8Array,Uint8Array,Int16Array,Uint16Array,Int32Array,Uint32Array,Float32Array,Float64Array,BigInt64Array,BigUint64Array][F];G1(q>>>=0,{name:K=X1(K>>>0),fromWireType:M,zd:R1,readValueFromPointer:M},{Pd:!0})}function n4(q,F){G1(q>>>=0,{name:F=X1(F>>>0),fromWireType:function(K){for(var M,O=r()[K>>>2>>>0],$=K+4,Z=$,_=0;_<=O;++_){var b=$+_;_!=O&&N0()[b>>>0]!=0||(Z=b0(Z,b-Z),M===void 0?M=Z:(M+="\x00",M+=Z),Z=b+1)}return H1(K),M},toWireType:function(K,M){M instanceof ArrayBuffer&&(M=new Uint8Array(M));var O=typeof M=="string";if(!(O||M instanceof Uint8Array||M instanceof Uint8ClampedArray||M instanceof Int8Array))throw new O1("Cannot pass non-string to std::string");var $=O?b7(M):M.length,Z=v6(4+$+1),_=Z+4;if(r()[Z>>>2>>>0]=$,O)_1(M,_,$+1);else if(O)for(O=0;O<$;++O){var b=M.charCodeAt(O);if(255<b)throw H1(Z),new O1("String has UTF-16 code units that do not fit in 8 bits");N0()[_+O>>>0]=b}else for(O=0;O<$;++O)N0()[_+O>>>0]=M[O];return K!==null&&K.push(H1,Z),Z},zd:R1,readValueFromPointer:F8,Ad(K){H1(K)}})}var o7=typeof TextDecoder<"u"?new TextDecoder("utf-16le"):void 0,r4=(q,F)=>{for(var K=q>>1,M=K+F/2;!(K>=M)&&p()[K>>>0];)++K;if(32<(K<<=1)-q&&o7)return o7.decode(N0().slice(q,K));for(K="",M=0;!(M>=F/2);++M){var O=f()[q+2*M>>>1>>>0];if(O==0)break;K+=String.fromCharCode(O)}return K},t4=(q,F,K)=>{if(K??=2147483647,2>K)return 0;var M=F;K=(K-=2)<2*q.length?K/2:q.length;for(var O=0;O<K;++O){var $=q.charCodeAt(O);f()[F>>>1>>>0]=$,F+=2}return f()[F>>>1>>>0]=0,F-M},e4=(q)=>2*q.length,JJ=(q,F)=>{for(var K=0,M="";!(K>=F/4);){var O=v()[q+4*K>>>2>>>0];if(O==0)break;++K,65536<=O?(O-=65536,M+=String.fromCharCode(55296|O>>10,56320|1023&O)):M+=String.fromCharCode(O)}return M},QJ=(q,F,K)=>{if(F>>>=0,K??=2147483647,4>K)return 0;var M=F;K=M+K-4;for(var O=0;O<q.length;++O){var $=q.charCodeAt(O);if(55296<=$&&57343>=$&&($=65536+((1023&$)<<10)|1023&q.charCodeAt(++O)),v()[F>>>2>>>0]=$,(F+=4)+4>K)break}return v()[F>>>2>>>0]=0,F-M},XJ=(q)=>{for(var F=0,K=0;K<q.length;++K){var M=q.charCodeAt(K);55296<=M&&57343>=M&&++K,F+=4}return F};function YJ(q,F,K){if(q>>>=0,F>>>=0,K=X1(K>>>=0),F===2)var M=r4,O=t4,$=e4,Z=(_)=>p()[_>>>1>>>0];else F===4&&(M=JJ,O=QJ,$=XJ,Z=(_)=>r()[_>>>2>>>0]);G1(q,{name:K,fromWireType:(_)=>{for(var b,y=r()[_>>>2>>>0],c=_+4,n=0;n<=y;++n){var H0=_+4+n*F;n!=y&&Z(H0)!=0||(c=M(c,H0-c),b===void 0?b=c:(b+="\x00",b+=c),c=H0+F)}return H1(_),b},toWireType:(_,b)=>{if(typeof b!="string")throw new O1(`Cannot pass non-string to C++ string type ${K}`);var y=$(b),c=v6(4+y+F);return r()[c>>>2>>>0]=y/F,O(b,c+4,y+F),_!==null&&_.push(H1,c),c},zd:R1,readValueFromPointer:F8,Ad(_){H1(_)}})}function HJ(q,F){G1(q>>>=0,{Qd:!0,name:F=X1(F>>>0),zd:0,fromWireType:()=>{},toWireType:()=>{}})}function qJ(q){O8(q>>>0,!G,1,!W,131072,!1),$7()}var N8=(q)=>{if(!G0)try{if(q(),!(0<L1))try{j?R8(k):Y8(k)}catch(F){F instanceof A6||F=="unwind"||E(0,F)}}catch(F){F instanceof A6||F=="unwind"||E(0,F)}};function V8(q){q>>>=0,typeof Atomics.ge=="function"&&(Atomics.ge(v(),q>>>2,q).value.then(P6),q+=128,Atomics.store(v(),q>>>2,1))}var P6=()=>{var q=b6();q&&(V8(q),N8(z9))};function WJ(q,F){(q>>>=0)==F>>>0?setTimeout(P6):j?postMessage({Ed:q,yd:"checkMailbox"}):(q=S1[q])&&q.postMessage({yd:"checkMailbox"})}var K8=[];function GJ(q,F,K,M,O){for(F>>>=0,M/=2,K8.length=M,K=O>>>0>>>3,O=0;O<M;O++)K8[O]=h[K+2*O]?h[K+2*O+1]:o0()[K+2*O+1>>>0];return(F?J8[F]:JQ[q])(...K8)}var jJ=()=>{L1=0};function FJ(q){q>>>=0,j?postMessage({yd:"cleanupThread",ee:q}):z7(S1[q])}function NJ(q){}var S6=(q,F)=>{var K=W8[q];if(K===void 0)throw q=U9(q),K=X1(q),H1(q),new O1(`${F} has unknown type ${K}`);return K},s7=(q,F,K)=>{var M=[];return q=q.toWireType(M,K),M.length&&(r()[F>>>2>>>0]=n0(M)),q};function VJ(q,F,K){return F>>>=0,K>>>=0,q=s0(q>>>0),F=S6(F,"emval::as"),s7(F,K,q)}function KJ(q,F){return F>>>=0,q=s0(q>>>0),(F=S6(F,"emval::as")).toWireType(null,q)}var Z6=(q)=>{try{q()}catch(F){W1(F)}},E1=0,Y1=null,a7=0,w6=[],i7={},n7={},MJ=0,M8=null,BJ=[];function r7(q){return function(F){if(!G0){if(E1===0){var K=!1,M=!1;F((O=0)=>{if(!G0&&(a7=O,K=!0,M)){E1=2,Z6(()=>D2(Y1)),typeof MainLoop<"u"&&MainLoop.Md&&MainLoop.resume(),O=!1;try{var $=function(){var b=v()[Y1+8>>>2>>>0];return b=x[n7[b]],--L1,b()}()}catch(b){$=b,O=!0}var Z=!1;if(!Y1){var _=M8;_&&(M8=null,(O?_.reject:_.resolve)($),Z=!0)}if(O&&!Z)throw $}}),M=!0,K||(E1=1,Y1=function(){var O=v6(65548),$=O+12;r()[O>>>2>>>0]=$,r()[O+4>>>2>>>0]=$+65536,$=w6[0];var Z=i7[$];return Z===void 0&&(Z=MJ++,i7[$]=Z,n7[Z]=$),$=Z,v()[O+8>>>2>>>0]=$,O}(),typeof MainLoop<"u"&&MainLoop.Md&&MainLoop.pause(),Z6(()=>R2(Y1)))}else E1===2?(E1=0,Z6(A2),H1(Y1),Y1=null,BJ.forEach(N8)):W1(`invalid state: ${E1}`);return a7}}((F)=>{q().then(F)})}function LJ(q){return q>>>=0,r7(async()=>{var F=await s0(q);return n0(F)})}var k6=[];function UJ(q,F,K,M){return K>>>=0,M>>>=0,(q=k6[q>>>0])(null,F=s0(F>>>0),K,M)}var OJ={},C6=(q)=>{var F=OJ[q];return F===void 0?X1(q):F};function RJ(q,F,K,M,O){return K>>>=0,M>>>=0,O>>>=0,(q=k6[q>>>0])(F=s0(F>>>0),F[K=C6(K)],M,O)}var t7=()=>typeof globalThis=="object"?globalThis:Function("return this")();function EJ(q){return(q>>>=0)==0?n0(t7()):(q=C6(q),n0(t7()[q]))}var DJ=(q)=>{var F=k6.length;return k6.push(q),F},AJ=(q,F)=>{for(var K=Array(q),M=0;M<q;++M)K[M]=S6(r()[F+4*M>>>2>>>0],"parameter "+M);return K},e7=(q,F)=>Object.defineProperty(F,"name",{value:q});function zJ(q,F,K){var M=(F=AJ(q,F>>>0)).shift();q--;var O=`return function (obj, func, destructorsRef, args) {
`,$=0,Z=[];K===0&&Z.push("obj");for(var _=["retType"],b=[M],y=0;y<q;++y)Z.push("arg"+y),_.push("argType"+y),b.push(F[y]),O+=`  var arg${y} = argType${y}.readValueFromPointer(args${$?"+"+$:""});
`,$+=F[y].zd;return O+=`  var rv = ${K===1?"new func":"func.call"}(${Z.join(", ")});
`,M.Qd||(_.push("emval_returnValue"),b.push(s7),O+=`  return emval_returnValue(retType, destructorsRef, rv);
`),_.push(O+`};
`),q=function(c){var n=Function;if(!(n instanceof Function))throw TypeError(`new_ called with constructor type ${typeof n} which is not a function`);var H0=e7(n.name||"unknownFunctionName",function(){});return H0.prototype=n.prototype,H0=new H0,(c=n.apply(H0,c))instanceof Object?c:H0}(_)(...b),K=`methodCaller<(${F.map((c)=>c.name).join(", ")}) => ${M.name}>`,DJ(e7(K,q))}function $J(q){return q=C6(q>>>0),n0(Y[q])}function PJ(q,F){return F>>>=0,q=s0(q>>>0),F=s0(F),n0(q[F])}function SJ(q){9<(q>>>=0)&&(j1[q+1]+=1)}function ZJ(){return n0([])}function wJ(q){q=s0(q>>>0);for(var F=Array(q.length),K=0;K<q.length;K++)F[K]=q[K];return n0(F)}function kJ(q){return n0(C6(q>>>0))}function CJ(){return n0({})}function IJ(q){for(var F=s0(q>>>=0);F.length;){var K=F.pop();F.pop()(K)}j8(q)}function _J(q,F,K){F>>>=0,K>>>=0,q=s0(q>>>0),F=s0(F),K=s0(K),q[F]=K}function bJ(q,F){return F>>>=0,q=(q=S6(q>>>0,"_emval_take_value")).readValueFromPointer(F),n0(q)}function vJ(q,F){q=-9007199254740992>q||9007199254740992<q?NaN:Number(q),F>>>=0,q=new Date(1000*q),v()[F>>>2>>>0]=q.getUTCSeconds(),v()[F+4>>>2>>>0]=q.getUTCMinutes(),v()[F+8>>>2>>>0]=q.getUTCHours(),v()[F+12>>>2>>>0]=q.getUTCDate(),v()[F+16>>>2>>>0]=q.getUTCMonth(),v()[F+20>>>2>>>0]=q.getUTCFullYear()-1900,v()[F+24>>>2>>>0]=q.getUTCDay(),q=(q.getTime()-Date.UTC(q.getUTCFullYear(),0,1,0,0,0,0))/86400000|0,v()[F+28>>>2>>>0]=q}var J9=(q)=>q%4==0&&(q%100!=0||q%400==0),Q9=[0,31,60,91,121,152,182,213,244,274,305,335],X9=[0,31,59,90,120,151,181,212,243,273,304,334];function TJ(q,F){q=-9007199254740992>q||9007199254740992<q?NaN:Number(q),F>>>=0,q=new Date(1000*q),v()[F>>>2>>>0]=q.getSeconds(),v()[F+4>>>2>>>0]=q.getMinutes(),v()[F+8>>>2>>>0]=q.getHours(),v()[F+12>>>2>>>0]=q.getDate(),v()[F+16>>>2>>>0]=q.getMonth(),v()[F+20>>>2>>>0]=q.getFullYear()-1900,v()[F+24>>>2>>>0]=q.getDay();var K=(J9(q.getFullYear())?Q9:X9)[q.getMonth()]+q.getDate()-1|0;v()[F+28>>>2>>>0]=K,v()[F+36>>>2>>>0]=-60*q.getTimezoneOffset(),K=new Date(q.getFullYear(),6,1).getTimezoneOffset();var M=new Date(q.getFullYear(),0,1).getTimezoneOffset();q=0|(K!=M&&q.getTimezoneOffset()==Math.min(M,K)),v()[F+32>>>2>>>0]=q}function xJ(q){q>>>=0;var F=new Date(v()[q+20>>>2>>>0]+1900,v()[q+16>>>2>>>0],v()[q+12>>>2>>>0],v()[q+8>>>2>>>0],v()[q+4>>>2>>>0],v()[q>>>2>>>0],0),K=v()[q+32>>>2>>>0],M=F.getTimezoneOffset(),O=new Date(F.getFullYear(),6,1).getTimezoneOffset(),$=new Date(F.getFullYear(),0,1).getTimezoneOffset(),Z=Math.min($,O);return 0>K?v()[q+32>>>2>>>0]=+(O!=$&&Z==M):0<K!=(Z==M)&&(O=Math.max($,O),F.setTime(F.getTime()+60000*((0<K?Z:O)-M))),v()[q+24>>>2>>>0]=F.getDay(),K=(J9(F.getFullYear())?Q9:X9)[F.getMonth()]+F.getDate()-1|0,v()[q+28>>>2>>>0]=K,v()[q>>>2>>>0]=F.getSeconds(),v()[q+4>>>2>>>0]=F.getMinutes(),v()[q+8>>>2>>>0]=F.getHours(),v()[q+12>>>2>>>0]=F.getDate(),v()[q+16>>>2>>>0]=F.getMonth(),v()[q+20>>>2>>>0]=F.getYear(),q=F.getTime(),BigInt(isNaN(q)?-1:q/1000)}function Y9(q,F,K,M,O,$,Z){return j?$0(16,1,q,F,K,M,O,$,Z):-52}function H9(q,F,K,M,O,$){if(j)return $0(17,1,q,F,K,M,O,$)}var i1={},fJ=()=>performance.timeOrigin+performance.now();function q9(q,F){if(j)return $0(18,1,q,F);if(i1[q]&&(clearTimeout(i1[q].id),delete i1[q]),!F)return 0;var K=setTimeout(()=>{delete i1[q],N8(()=>A9(q,performance.timeOrigin+performance.now()))},F);return i1[q]={id:K,ke:F},0}function hJ(q,F,K,M){q>>>=0,F>>>=0,K>>>=0,M>>>=0;var O=new Date().getFullYear(),$=new Date(O,0,1).getTimezoneOffset();O=new Date(O,6,1).getTimezoneOffset();var Z=Math.max($,O);r()[q>>>2>>>0]=60*Z,v()[F>>>2>>>0]=+($!=O),q=(F=(_)=>{var b=Math.abs(_);return`UTC${0<=_?"-":"+"}${String(Math.floor(b/60)).padStart(2,"0")}${String(b%60).padStart(2,"0")}`})($),F=F(O),O<$?(_1(q,K,17),_1(F,M,17)):(_1(q,M,17),_1(F,K,17))}var yJ=()=>Date.now(),gJ=1;function lJ(q,F,K){if(!(0<=q&&3>=q))return 28;if(q===0)q=Date.now();else{if(!gJ)return 52;q=performance.timeOrigin+performance.now()}return h[K>>>0>>>3]=BigInt(Math.round(1e6*q)),0}var B8=[],W9=(q,F)=>{B8.length=0;for(var K;K=N0()[q++>>>0];){var M=K!=105;F+=(M&=K!=112)&&F%8?4:0,B8.push(K==112?r()[F>>>2>>>0]:K==106?h[F>>>3]:K==105?v()[F>>>2>>>0]:o0()[F>>>3>>>0]),F+=M?8:4}return B8};function mJ(q,F,K){return q>>>=0,F=W9(F>>>0,K>>>0),J8[q](...F)}function pJ(q,F,K){return q>>>=0,F=W9(F>>>0,K>>>0),J8[q](...F)}var cJ=()=>{};function dJ(q,F){return D(b0(q>>>0,F>>>0))}var uJ=()=>{throw L1+=1,"unwind"};function oJ(){return 4294901760}var sJ=()=>navigator.hardwareConcurrency;function aJ(){return W1("Cannot use emscripten_pc_get_function without -sUSE_OFFSET_CONVERTER"),0}function iJ(q){q>>>=0;var F=N0().length;if(q<=F||4294901760<q)return!1;for(var K=1;4>=K;K*=2){var M=F*(1+0.2/K);M=Math.min(M,q+100663296);J:{M=(Math.min(4294901760,65536*Math.ceil(Math.max(q,M)/65536))-S.buffer.byteLength+65535)/65536|0;try{S.grow(M),u0();var O=1;break J}catch{}O=void 0}if(O)return!0}return!1}var I6=()=>(W1("Cannot use convertFrameToPC (needed by __builtin_return_address) without -sUSE_OFFSET_CONVERTER"),0),b1={},G9=(q)=>{q.forEach((F)=>{var K=I6();K&&(b1[K]=F)})};function nJ(){var q=Error().stack.toString().split(`
`);return q[0]=="Error"&&q.shift(),G9(q),b1.Kd=I6(),b1.ae=q,b1.Kd}function rJ(q,F,K){if(q>>>=0,F>>>=0,b1.Kd==q)var M=b1.ae;else(M=Error().stack.toString().split(`
`))[0]=="Error"&&M.shift(),G9(M);for(var O=3;M[O]&&I6()!=q;)++O;for(q=0;q<K&&M[q+O];++q)v()[F+4*q>>>2>>>0]=I6();return q}var L8,U8={},j9=()=>{if(!L8){var q,F={USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user",LANG:(typeof navigator=="object"&&navigator.languages&&navigator.languages[0]||"C").replace("-","_")+".UTF-8",_:"./this.program"};for(q in U8)U8[q]===void 0?delete F[q]:F[q]=U8[q];var K=[];for(q in F)K.push(`${q}=${F[q]}`);L8=K}return L8};function F9(q,F){if(j)return $0(19,1,q,F);q>>>=0,F>>>=0;var K=0;return j9().forEach((M,O)=>{var $=F+K;for(O=r()[q+4*O>>>2>>>0]=$,$=0;$<M.length;++$)s()[O++>>>0]=M.charCodeAt($);s()[O>>>0]=0,K+=M.length+1}),0}function N9(q,F){if(j)return $0(20,1,q,F);q>>>=0,F>>>=0;var K=j9();r()[q>>>2>>>0]=K.length;var M=0;return K.forEach((O)=>M+=O.length+1),r()[F>>>2>>>0]=M,0}function V9(q){return j?$0(21,1,q):52}function K9(q,F,K,M){return j?$0(22,1,q,F,K,M):52}function M9(q,F,K,M){return j?$0(23,1,q,F,K,M):70}var tJ=[null,[],[]];function B9(q,F,K,M){if(j)return $0(24,1,q,F,K,M);F>>>=0,K>>>=0,M>>>=0;for(var O=0,$=0;$<K;$++){var Z=r()[F>>>2>>>0],_=r()[F+4>>>2>>>0];F+=8;for(var b=0;b<_;b++){var y=N0()[Z+b>>>0],c=tJ[q];y===0||y===10?((q===1?z:D)(C7(c)),c.length=0):c.push(y)}O+=_}return r()[M>>>2>>>0]=O,0}function eJ(q){return q>>>0}j||function(){for(var q=Y.numThreads-1;q--;)S7();Q8.unshift(()=>{o1++,function(F){j?F():Promise.all(U1.map(P7)).then(F)}(()=>U7())})}();for(var L9=Array(256),_6=0;256>_6;++_6)L9[_6]=String.fromCharCode(_6);d7=L9,O1=Y.BindingError=class extends Error{constructor(q){super(q),this.name="BindingError"}},Y.InternalError=class extends Error{constructor(q){super(q),this.name="InternalError"}},j1.push(0,1,void 0,1,null,1,!0,1,!1,1),Y.count_emval_handles=()=>j1.length/2-5-G8.length;var x,JQ=[X8,D7,Z7,I7,_7,v7,T7,x7,f7,h7,y7,g7,l7,m7,p7,c7,Y9,H9,q9,F9,N9,V9,K9,M9,B9];(async function(){function q(M,O){return x=M.exports,x=function(){var $=x,Z={};for(let[_,b]of Object.entries($))Z[_]=typeof b=="function"?(...y)=>{w6.push(_);try{return b(...y)}finally{G0||(w6.pop(),Y1&&E1===1&&w6.length===0&&(E1=0,L1+=1,Z6(E2),typeof Fibers<"u"&&Fibers.le()))}}:b;return Z}(),x=function(){var $=x,Z=(b)=>(y)=>b(y)>>>0,_=(b)=>()=>b()>>>0;return($=Object.assign({},$)).Cb=Z($.Cb),$.fc=_($.fc),$.ic=Z($.ic),$.vc=Z($.vc),$.wc=_($.wc),$.Ac=Z($.Ac),$}(),A7.push(x.jc),w=O,U7(),x}o1++;var F=O7();if(Y.instantiateWasm)return new Promise((M)=>{Y.instantiateWasm(F,(O,$)=>{q(O,$),M(O.exports)})});if(j)return new Promise((M)=>{_0=(O)=>{var $=new WebAssembly.Instance(O,O7());M(q($,O))}});e6??=Y.locateFile?Y.locateFile?Y.locateFile("ort-wasm-simd-threaded.jsep.wasm",R):R+"ort-wasm-simd-threaded.jsep.wasm":new URL("ort-wasm-simd-threaded.jsep.wasm",import.meta.url).href;try{var K=await async function(M){var O=e6;if(!o&&typeof WebAssembly.instantiateStreaming=="function"&&!F0(O))try{var $=fetch(O,{credentials:"same-origin"});return await WebAssembly.instantiateStreaming($,M)}catch(Z){D(`wasm streaming compile failed: ${Z}`),D("falling back to ArrayBuffer instantiation")}return async function(Z,_){try{var b=await async function(y){if(!o)try{var c=await L(y);return new Uint8Array(c)}catch{}if(y==e6&&o)y=new Uint8Array(o);else{if(!B)throw"both async and sync fetching of the wasm failed";y=B(y)}return y}(Z);return await WebAssembly.instantiate(b,_)}catch(y){D(`failed to asynchronously prepare wasm: ${y}`),W1(y)}}(O,M)}(F);return q(K.instance,K.module)}catch(M){return X(M),Promise.reject(M)}})();var U9=(q)=>(U9=x.Cb)(q),O9=()=>(O9=x.Db)();Y._OrtInit=(q,F)=>(Y._OrtInit=x.Eb)(q,F),Y._OrtGetLastError=(q,F)=>(Y._OrtGetLastError=x.Fb)(q,F),Y._OrtCreateSessionOptions=(q,F,K,M,O,$,Z,_,b,y)=>(Y._OrtCreateSessionOptions=x.Gb)(q,F,K,M,O,$,Z,_,b,y),Y._OrtAppendExecutionProvider=(q,F)=>(Y._OrtAppendExecutionProvider=x.Hb)(q,F),Y._OrtAddFreeDimensionOverride=(q,F,K)=>(Y._OrtAddFreeDimensionOverride=x.Ib)(q,F,K),Y._OrtAddSessionConfigEntry=(q,F,K)=>(Y._OrtAddSessionConfigEntry=x.Jb)(q,F,K),Y._OrtReleaseSessionOptions=(q)=>(Y._OrtReleaseSessionOptions=x.Kb)(q),Y._OrtCreateSession=(q,F,K)=>(Y._OrtCreateSession=x.Lb)(q,F,K),Y._OrtReleaseSession=(q)=>(Y._OrtReleaseSession=x.Mb)(q),Y._OrtGetInputOutputCount=(q,F,K)=>(Y._OrtGetInputOutputCount=x.Nb)(q,F,K),Y._OrtGetInputName=(q,F)=>(Y._OrtGetInputName=x.Ob)(q,F),Y._OrtGetOutputName=(q,F)=>(Y._OrtGetOutputName=x.Pb)(q,F),Y._OrtFree=(q)=>(Y._OrtFree=x.Qb)(q),Y._OrtCreateTensor=(q,F,K,M,O,$)=>(Y._OrtCreateTensor=x.Rb)(q,F,K,M,O,$),Y._OrtGetTensorData=(q,F,K,M,O)=>(Y._OrtGetTensorData=x.Sb)(q,F,K,M,O),Y._OrtReleaseTensor=(q)=>(Y._OrtReleaseTensor=x.Tb)(q),Y._OrtCreateRunOptions=(q,F,K,M)=>(Y._OrtCreateRunOptions=x.Ub)(q,F,K,M),Y._OrtAddRunConfigEntry=(q,F,K)=>(Y._OrtAddRunConfigEntry=x.Vb)(q,F,K),Y._OrtReleaseRunOptions=(q)=>(Y._OrtReleaseRunOptions=x.Wb)(q),Y._OrtCreateBinding=(q)=>(Y._OrtCreateBinding=x.Xb)(q),Y._OrtBindInput=(q,F,K)=>(Y._OrtBindInput=x.Yb)(q,F,K),Y._OrtBindOutput=(q,F,K,M)=>(Y._OrtBindOutput=x.Zb)(q,F,K,M),Y._OrtClearBoundOutputs=(q)=>(Y._OrtClearBoundOutputs=x._b)(q),Y._OrtReleaseBinding=(q)=>(Y._OrtReleaseBinding=x.$b)(q),Y._OrtRunWithBinding=(q,F,K,M,O)=>(Y._OrtRunWithBinding=x.ac)(q,F,K,M,O),Y._OrtRun=(q,F,K,M,O,$,Z,_)=>(Y._OrtRun=x.bc)(q,F,K,M,O,$,Z,_),Y._OrtEndProfiling=(q)=>(Y._OrtEndProfiling=x.cc)(q),Y._JsepOutput=(q,F,K)=>(Y._JsepOutput=x.dc)(q,F,K),Y._JsepGetNodeName=(q)=>(Y._JsepGetNodeName=x.ec)(q);var b6=()=>(b6=x.fc)(),H1=Y._free=(q)=>(H1=Y._free=x.gc)(q),v6=Y._malloc=(q)=>(v6=Y._malloc=x.ic)(q),O8=(q,F,K,M,O,$)=>(O8=x.kc)(q,F,K,M,O,$),R9=()=>(R9=x.lc)(),E9=(q,F,K,M,O)=>(E9=x.mc)(q,F,K,M,O),D9=(q)=>(D9=x.nc)(q),R8=(q)=>(R8=x.oc)(q),A9=(q,F)=>(A9=x.pc)(q,F),z9=()=>(z9=x.qc)(),Y0=(q,F)=>(Y0=x.rc)(q,F),n1=(q)=>(n1=x.sc)(q),$9=(q,F)=>($9=x.tc)(q,F),e=(q)=>(e=x.uc)(q),E8=(q)=>(E8=x.vc)(q),X0=()=>(X0=x.wc)(),P9=(q)=>(P9=x.xc)(q),S9=(q)=>(S9=x.yc)(q),Z9=(q,F,K)=>(Z9=x.zc)(q,F,K),w9=(q)=>(w9=x.Ac)(q),k9=Y.dynCall_iii=(q,F,K)=>(k9=Y.dynCall_iii=x.Bc)(q,F,K),C9=Y.dynCall_vi=(q,F)=>(C9=Y.dynCall_vi=x.Cc)(q,F),D8=Y.dynCall_ii=(q,F)=>(D8=Y.dynCall_ii=x.Dc)(q,F),I9=Y.dynCall_vii=(q,F,K)=>(I9=Y.dynCall_vii=x.Ec)(q,F,K),_9=Y.dynCall_iiii=(q,F,K,M)=>(_9=Y.dynCall_iiii=x.Fc)(q,F,K,M),b9=Y.dynCall_viii=(q,F,K,M)=>(b9=Y.dynCall_viii=x.Gc)(q,F,K,M),v9=Y.dynCall_iiiii=(q,F,K,M,O)=>(v9=Y.dynCall_iiiii=x.Hc)(q,F,K,M,O),T9=Y.dynCall_viiii=(q,F,K,M,O)=>(T9=Y.dynCall_viiii=x.Ic)(q,F,K,M,O),x9=Y.dynCall_viiiiii=(q,F,K,M,O,$,Z)=>(x9=Y.dynCall_viiiiii=x.Jc)(q,F,K,M,O,$,Z),f9=Y.dynCall_viiiiiii=(q,F,K,M,O,$,Z,_)=>(f9=Y.dynCall_viiiiiii=x.Kc)(q,F,K,M,O,$,Z,_),h9=Y.dynCall_ji=(q,F)=>(h9=Y.dynCall_ji=x.Lc)(q,F),y9=Y.dynCall_v=(q)=>(y9=Y.dynCall_v=x.Mc)(q),g9=Y.dynCall_viiiii=(q,F,K,M,O,$)=>(g9=Y.dynCall_viiiii=x.Nc)(q,F,K,M,O,$),l9=Y.dynCall_i=(q)=>(l9=Y.dynCall_i=x.Oc)(q),m9=Y.dynCall_fii=(q,F,K)=>(m9=Y.dynCall_fii=x.Pc)(q,F,K),p9=Y.dynCall_viiiiiiii=(q,F,K,M,O,$,Z,_,b)=>(p9=Y.dynCall_viiiiiiii=x.Qc)(q,F,K,M,O,$,Z,_,b),c9=Y.dynCall_viiiiiiiiii=(q,F,K,M,O,$,Z,_,b,y,c)=>(c9=Y.dynCall_viiiiiiiiii=x.Rc)(q,F,K,M,O,$,Z,_,b,y,c),d9=Y.dynCall_jiii=(q,F,K,M)=>(d9=Y.dynCall_jiii=x.Sc)(q,F,K,M),u9=Y.dynCall_dii=(q,F,K)=>(u9=Y.dynCall_dii=x.Tc)(q,F,K),o9=Y.dynCall_viiiiiiiii=(q,F,K,M,O,$,Z,_,b,y)=>(o9=Y.dynCall_viiiiiiiii=x.Uc)(q,F,K,M,O,$,Z,_,b,y),s9=Y.dynCall_viiiiiiiiiii=(q,F,K,M,O,$,Z,_,b,y,c,n)=>(s9=Y.dynCall_viiiiiiiiiii=x.Vc)(q,F,K,M,O,$,Z,_,b,y,c,n),a9=Y.dynCall_iiiiii=(q,F,K,M,O,$)=>(a9=Y.dynCall_iiiiii=x.Wc)(q,F,K,M,O,$),i9=Y.dynCall_iij=(q,F,K)=>(i9=Y.dynCall_iij=x.Xc)(q,F,K),n9=Y.dynCall_iiiiiiiiii=(q,F,K,M,O,$,Z,_,b,y)=>(n9=Y.dynCall_iiiiiiiiii=x.Yc)(q,F,K,M,O,$,Z,_,b,y),r9=Y.dynCall_iiiiiiiiiii=(q,F,K,M,O,$,Z,_,b,y,c)=>(r9=Y.dynCall_iiiiiiiiiii=x.Zc)(q,F,K,M,O,$,Z,_,b,y,c),t9=Y.dynCall_vij=(q,F,K)=>(t9=Y.dynCall_vij=x._c)(q,F,K),e9=Y.dynCall_iiif=(q,F,K,M)=>(e9=Y.dynCall_iiif=x.$c)(q,F,K,M),J2=Y.dynCall_iiij=(q,F,K,M)=>(J2=Y.dynCall_iiij=x.ad)(q,F,K,M),Q2=Y.dynCall_fiii=(q,F,K,M)=>(Q2=Y.dynCall_fiii=x.bd)(q,F,K,M),X2=Y.dynCall_viiiiiiiiiiiii=(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0)=>(X2=Y.dynCall_viiiiiiiiiiiii=x.cd)(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0),Y2=Y.dynCall_vjiii=(q,F,K,M,O)=>(Y2=Y.dynCall_vjiii=x.dd)(q,F,K,M,O),H2=Y.dynCall_vif=(q,F,K)=>(H2=Y.dynCall_vif=x.ed)(q,F,K),q2=Y.dynCall_iiiiiii=(q,F,K,M,O,$,Z)=>(q2=Y.dynCall_iiiiiii=x.fd)(q,F,K,M,O,$,Z),W2=Y.dynCall_iiiij=(q,F,K,M,O)=>(W2=Y.dynCall_iiiij=x.gd)(q,F,K,M,O),G2=Y.dynCall_iiiiiiii=(q,F,K,M,O,$,Z,_)=>(G2=Y.dynCall_iiiiiiii=x.hd)(q,F,K,M,O,$,Z,_),j2=Y.dynCall_viiiiiiiiiiii=(q,F,K,M,O,$,Z,_,b,y,c,n,H0)=>(j2=Y.dynCall_viiiiiiiiiiii=x.id)(q,F,K,M,O,$,Z,_,b,y,c,n,H0),F2=Y.dynCall_diii=(q,F,K,M)=>(F2=Y.dynCall_diii=x.jd)(q,F,K,M),N2=Y.dynCall_jiiii=(q,F,K,M,O)=>(N2=Y.dynCall_jiiii=x.kd)(q,F,K,M,O),V2=Y.dynCall_viiij=(q,F,K,M,O)=>(V2=Y.dynCall_viiij=x.ld)(q,F,K,M,O),K2=Y.dynCall_fiiii=(q,F,K,M,O)=>(K2=Y.dynCall_fiiii=x.md)(q,F,K,M,O),M2=Y.dynCall_viiif=(q,F,K,M,O)=>(M2=Y.dynCall_viiif=x.nd)(q,F,K,M,O),B2=Y.dynCall_diiii=(q,F,K,M,O)=>(B2=Y.dynCall_diiii=x.od)(q,F,K,M,O),L2=Y.dynCall_viiid=(q,F,K,M,O)=>(L2=Y.dynCall_viiid=x.pd)(q,F,K,M,O),U2=Y.dynCall_iiiijii=(q,F,K,M,O,$,Z)=>(U2=Y.dynCall_iiiijii=x.qd)(q,F,K,M,O,$,Z),O2=Y.dynCall_iiiiiij=(q,F,K,M,O,$,Z)=>(O2=Y.dynCall_iiiiiij=x.rd)(q,F,K,M,O,$,Z),R2=(q)=>(R2=x.sd)(q),E2=()=>(E2=x.td)(),D2=(q)=>(D2=x.ud)(q),A2=()=>(A2=x.vd)();function QQ(q,F,K){var M=X0();try{I9(q,F,K)}catch(O){if(e(M),O!==O+0)throw O;Y0(1,0)}}function XQ(q,F,K){var M=X0();try{return k9(q,F,K)}catch(O){if(e(M),O!==O+0)throw O;Y0(1,0)}}function YQ(q,F){var K=X0();try{C9(q,F)}catch(M){if(e(K),M!==M+0)throw M;Y0(1,0)}}function HQ(q,F){var K=X0();try{return D8(q,F)}catch(M){if(e(K),M!==M+0)throw M;Y0(1,0)}}function qQ(q,F,K,M){var O=X0();try{return _9(q,F,K,M)}catch($){if(e(O),$!==$+0)throw $;Y0(1,0)}}function WQ(q,F,K,M,O){var $=X0();try{T9(q,F,K,M,O)}catch(Z){if(e($),Z!==Z+0)throw Z;Y0(1,0)}}function GQ(q,F,K,M,O){var $=X0();try{return v9(q,F,K,M,O)}catch(Z){if(e($),Z!==Z+0)throw Z;Y0(1,0)}}function jQ(q,F,K,M){var O=X0();try{b9(q,F,K,M)}catch($){if(e(O),$!==$+0)throw $;Y0(1,0)}}function FQ(q,F,K,M,O,$,Z){var _=X0();try{return q2(q,F,K,M,O,$,Z)}catch(b){if(e(_),b!==b+0)throw b;Y0(1,0)}}function NQ(q){var F=X0();try{y9(q)}catch(K){if(e(F),K!==K+0)throw K;Y0(1,0)}}function VQ(q,F,K){var M=X0();try{return i9(q,F,K)}catch(O){if(e(M),O!==O+0)throw O;Y0(1,0)}}function KQ(q,F,K,M,O,$){var Z=X0();try{g9(q,F,K,M,O,$)}catch(_){if(e(Z),_!==_+0)throw _;Y0(1,0)}}function MQ(q,F,K){var M=X0();try{t9(q,F,K)}catch(O){if(e(M),O!==O+0)throw O;Y0(1,0)}}function BQ(q,F,K,M,O,$,Z){var _=X0();try{x9(q,F,K,M,O,$,Z)}catch(b){if(e(_),b!==b+0)throw b;Y0(1,0)}}function LQ(q,F,K,M,O,$,Z,_){var b=X0();try{f9(q,F,K,M,O,$,Z,_)}catch(y){if(e(b),y!==y+0)throw y;Y0(1,0)}}function UQ(q,F,K,M,O,$){var Z=X0();try{return a9(q,F,K,M,O,$)}catch(_){if(e(Z),_!==_+0)throw _;Y0(1,0)}}function OQ(q,F,K,M,O,$,Z,_){var b=X0();try{return G2(q,F,K,M,O,$,Z,_)}catch(y){if(e(b),y!==y+0)throw y;Y0(1,0)}}function RQ(q,F,K,M,O,$,Z,_,b,y){var c=X0();try{o9(q,F,K,M,O,$,Z,_,b,y)}catch(n){if(e(c),n!==n+0)throw n;Y0(1,0)}}function EQ(q,F,K,M,O,$,Z,_,b){var y=X0();try{p9(q,F,K,M,O,$,Z,_,b)}catch(c){if(e(y),c!==c+0)throw c;Y0(1,0)}}function DQ(q){var F=X0();try{return l9(q)}catch(K){if(e(F),K!==K+0)throw K;Y0(1,0)}}function AQ(q,F,K,M,O,$,Z,_,b,y){var c=X0();try{return n9(q,F,K,M,O,$,Z,_,b,y)}catch(n){if(e(c),n!==n+0)throw n;Y0(1,0)}}function zQ(q,F,K){var M=X0();try{return m9(q,F,K)}catch(O){if(e(M),O!==O+0)throw O;Y0(1,0)}}function $Q(q,F,K,M){var O=X0();try{return d9(q,F,K,M)}catch($){if(e(O),$!==$+0)throw $;return Y0(1,0),0n}}function PQ(q,F,K){var M=X0();try{return u9(q,F,K)}catch(O){if(e(M),O!==O+0)throw O;Y0(1,0)}}function SQ(q,F,K,M,O,$,Z,_,b,y,c,n){var H0=X0();try{s9(q,F,K,M,O,$,Z,_,b,y,c,n)}catch(D0){if(e(H0),D0!==D0+0)throw D0;Y0(1,0)}}function ZQ(q,F,K,M,O,$,Z,_,b,y,c){var n=X0();try{c9(q,F,K,M,O,$,Z,_,b,y,c)}catch(H0){if(e(n),H0!==H0+0)throw H0;Y0(1,0)}}function wQ(q,F,K,M,O,$,Z,_,b,y,c){var n=X0();try{return r9(q,F,K,M,O,$,Z,_,b,y,c)}catch(H0){if(e(n),H0!==H0+0)throw H0;Y0(1,0)}}function kQ(q,F,K,M){var O=X0();try{return e9(q,F,K,M)}catch($){if(e(O),$!==$+0)throw $;Y0(1,0)}}function CQ(q,F,K,M){var O=X0();try{return J2(q,F,K,M)}catch($){if(e(O),$!==$+0)throw $;Y0(1,0)}}function IQ(q,F,K,M){var O=X0();try{return Q2(q,F,K,M)}catch($){if(e(O),$!==$+0)throw $;Y0(1,0)}}function _Q(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0){var r0=X0();try{X2(q,F,K,M,O,$,Z,_,b,y,c,n,H0,D0)}catch(r1){if(e(r0),r1!==r1+0)throw r1;Y0(1,0)}}function bQ(q,F,K,M,O){var $=X0();try{Y2(q,F,K,M,O)}catch(Z){if(e($),Z!==Z+0)throw Z;Y0(1,0)}}function vQ(q,F,K){var M=X0();try{H2(q,F,K)}catch(O){if(e(M),O!==O+0)throw O;Y0(1,0)}}function TQ(q,F){var K=X0();try{return h9(q,F)}catch(M){if(e(K),M!==M+0)throw M;return Y0(1,0),0n}}function xQ(q,F,K,M,O){var $=X0();try{return W2(q,F,K,M,O)}catch(Z){if(e($),Z!==Z+0)throw Z;Y0(1,0)}}function fQ(q,F,K,M,O,$,Z,_,b,y,c,n,H0){var D0=X0();try{j2(q,F,K,M,O,$,Z,_,b,y,c,n,H0)}catch(r0){if(e(D0),r0!==r0+0)throw r0;Y0(1,0)}}function hQ(q,F,K,M){var O=X0();try{return F2(q,F,K,M)}catch($){if(e(O),$!==$+0)throw $;Y0(1,0)}}function yQ(q,F,K,M,O){var $=X0();try{return N2(q,F,K,M,O)}catch(Z){if(e($),Z!==Z+0)throw Z;return Y0(1,0),0n}}function gQ(q,F,K,M,O){var $=X0();try{V2(q,F,K,M,O)}catch(Z){if(e($),Z!==Z+0)throw Z;Y0(1,0)}}function lQ(q,F,K,M,O){var $=X0();try{return K2(q,F,K,M,O)}catch(Z){if(e($),Z!==Z+0)throw Z;Y0(1,0)}}function mQ(q,F,K,M,O){var $=X0();try{M2(q,F,K,M,O)}catch(Z){if(e($),Z!==Z+0)throw Z;Y0(1,0)}}function pQ(q,F,K,M,O){var $=X0();try{return B2(q,F,K,M,O)}catch(Z){if(e($),Z!==Z+0)throw Z;Y0(1,0)}}function cQ(q,F,K,M,O){var $=X0();try{L2(q,F,K,M,O)}catch(Z){if(e($),Z!==Z+0)throw Z;Y0(1,0)}}function dQ(q,F,K,M,O,$,Z){var _=X0();try{return U2(q,F,K,M,O,$,Z)}catch(b){if(e(_),b!==b+0)throw b;Y0(1,0)}}function uQ(q,F,K,M,O,$,Z){var _=X0();try{return O2(q,F,K,M,O,$,Z)}catch(b){if(e(_),b!==b+0)throw b;Y0(1,0)}}return Y.stackSave=()=>X0(),Y.stackRestore=(q)=>e(q),Y.stackAlloc=(q)=>E8(q),Y.setValue=function(q,F,K="i8"){switch(K.endsWith("*")&&(K="*"),K){case"i1":case"i8":s()[q>>>0]=F;break;case"i16":f()[q>>>1>>>0]=F;break;case"i32":v()[q>>>2>>>0]=F;break;case"i64":h[q>>>3]=BigInt(F);break;case"float":k0()[q>>>2>>>0]=F;break;case"double":o0()[q>>>3>>>0]=F;break;case"*":r()[q>>>2>>>0]=F;break;default:W1(`invalid type for setValue: ${K}`)}},Y.getValue=function(q,F="i8"){switch(F.endsWith("*")&&(F="*"),F){case"i1":case"i8":return s()[q>>>0];case"i16":return f()[q>>>1>>>0];case"i32":return v()[q>>>2>>>0];case"i64":return h[q>>>3];case"float":return k0()[q>>>2>>>0];case"double":return o0()[q>>>3>>>0];case"*":return r()[q>>>2>>>0];default:W1(`invalid type for getValue: ${F}`)}},Y.UTF8ToString=b0,Y.stringToUTF8=_1,Y.lengthBytesUTF8=b7,function q(){if(0<o1)s1=q;else if(j)Q(Y),D6();else{for(;0<Q8.length;)Q8.shift()(Y);0<o1?s1=q:(Y.calledRun=!0,G0||(D6(),Q(Y)))}}(),Y.PTR_SIZE=4,H}),uL=y3,sV=globalThis.self?.name?.startsWith("em-pthread"),sV&&y3()}),uY=Q0(()=>{dY(),g3=typeof location>"u"?void 0:location.origin,aV=()=>{return import.meta.url?.startsWith("file:")?new URL(new URL("ort.bundle.min.mjs",import.meta.url).href,g3).href:import.meta.url},f1=aV(),oL=()=>{if(f1&&!f1.startsWith("blob:"))return f1.substring(0,f1.lastIndexOf("/")+1)},u5=(J,Q)=>{try{let X=Q??f1;return(X?new URL(J,X):new URL(J)).origin===g3}catch{return!1}},iV=(J,Q)=>{let X=Q??f1;try{return(X?new URL(J,X):new URL(J)).href}catch{return}},nV=(J,Q)=>`${Q??"./"}${J}`,l3=async(J)=>{let Q=await(await fetch(J,{credentials:"same-origin"})).blob();return URL.createObjectURL(Q)},rV=async(J)=>(await import(J)).default,m3=(SA(),q4(pL)).default,sL=async()=>{if(!f1)throw Error("Failed to load proxy worker: cannot determine the script source URL.");if(u5(f1))return[void 0,m3()];let J=await l3(f1);return[J,m3(J)]},p3=(ZA(),q4(dL)).default,aL=async(J,Q,X)=>{if(!J&&!Q&&p3&&f1&&u5(f1))return[void 0,p3];{let Y="ort-wasm-simd-threaded.jsep.mjs",H=J??iV(Y,Q),W=X&&H&&!u5(H,Q),G=W?await l3(H):H??nV(Y,Q);return[W?G:void 0,await rV(G)]}}}),u8=Q0(()=>{uY(),o5=!1,g2=!1,d3=!1,tV=()=>{if(typeof SharedArrayBuffer>"u")return!1;try{return typeof MessageChannel<"u"&&new MessageChannel().port1.postMessage(new SharedArrayBuffer(1)),WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,5,4,1,3,1,1,10,11,1,9,0,65,0,254,16,2,0,26,11]))}catch{return!1}},eV=()=>{try{return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,30,1,28,0,65,0,253,15,253,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,253,186,1,26,11]))}catch{return!1}},oY=async(J)=>{if(o5)return Promise.resolve();if(g2)throw Error("multiple calls to 'initializeWebAssembly()' detected.");if(d3)throw Error("previous call to 'initializeWebAssembly()' failed.");g2=!0;let{initTimeout:Q,numThreads:X}=J;if(!eV())throw Error("WebAssembly SIMD is not supported in the current environment.");let Y=tV();X>1&&!Y&&(typeof self<"u"&&!self.crossOriginIsolated&&console.warn("env.wasm.numThreads is set to "+X+", but this will not work unless you enable crossOriginIsolated mode. See https://web.dev/cross-origin-isolation-guide/ for more info."),console.warn("WebAssembly multi-threading is not supported in the current environment. Falling back to single-threading."),J.numThreads=X=1);let H=J.wasmPaths,W=typeof H=="string"?H:void 0,G=H?.mjs,j=G?.href??G,N=H?.wasm,V=N?.href??N,L=J.wasmBinary,[B,U]=await aL(j,W,X>1),E=!1,R=[];if(Q>0&&R.push(new Promise((A)=>{setTimeout(()=>{E=!0,A()},Q)})),R.push(new Promise((A,P)=>{let z={numThreads:X};if(L)z.wasmBinary=L;else if(V||W)z.locateFile=(D)=>V??W+D;else if(j&&j.indexOf("blob:")!==0)z.locateFile=(D)=>new URL(D,j).href;else if(B){let D=oL();D&&(z.locateFile=(S)=>D+S)}U(z).then((D)=>{g2=!1,o5=!0,c3=D,A(),B&&URL.revokeObjectURL(B)},(D)=>{g2=!1,d3=!0,P(D)})})),await Promise.race(R),E)throw Error(`WebAssembly backend initializing failed due to timeout: ${Q}ms`)},V1=()=>{if(o5&&c3)return c3;throw Error("WebAssembly is not initialized yet.")}}),sY=Q0(()=>{u8(),A1=(J,Q)=>{let X=V1(),Y=X.lengthBytesUTF8(J)+1,H=X._malloc(Y);return X.stringToUTF8(J,H,Y),Q.push(H),H},W4=(J,Q,X,Y)=>{if(typeof J=="object"&&J!==null){if(X.has(J))throw Error("Circular reference in options");X.add(J)}Object.entries(J).forEach(([H,W])=>{let G=Q?Q+H:H;if(typeof W=="object")W4(W,G+".",X,Y);else if(typeof W=="string"||typeof W=="number")Y(G,W.toString());else if(typeof W=="boolean")Y(G,W?"1":"0");else throw Error(`Can't handle extra config type: ${typeof W}`)})},p0=(J)=>{let Q=V1(),X=Q.stackSave();try{let Y=Q.PTR_SIZE,H=Q.stackAlloc(2*Y);Q._OrtGetLastError(H,H+Y);let W=Number(Q.getValue(H,Y===4?"i32":"i64")),G=Q.getValue(H+Y,"*"),j=G?Q.UTF8ToString(G):"";throw Error(`${J} ERROR_CODE: ${W}, ERROR_MESSAGE: ${j}`)}finally{Q.stackRestore(X)}}}),wA=Q0(()=>{u8(),sY(),iL=(J)=>{let Q=V1(),X=0,Y=[],H=J||{};try{if(J?.logSeverityLevel===void 0)H.logSeverityLevel=2;else if(typeof J.logSeverityLevel!="number"||!Number.isInteger(J.logSeverityLevel)||J.logSeverityLevel<0||J.logSeverityLevel>4)throw Error(`log serverity level is not valid: ${J.logSeverityLevel}`);if(J?.logVerbosityLevel===void 0)H.logVerbosityLevel=0;else if(typeof J.logVerbosityLevel!="number"||!Number.isInteger(J.logVerbosityLevel))throw Error(`log verbosity level is not valid: ${J.logVerbosityLevel}`);J?.terminate===void 0&&(H.terminate=!1);let W=0;return J?.tag!==void 0&&(W=A1(J.tag,Y)),X=Q._OrtCreateRunOptions(H.logSeverityLevel,H.logVerbosityLevel,!!H.terminate,W),X===0&&p0("Can't create run options."),J?.extra!==void 0&&W4(J.extra,"",new WeakSet,(G,j)=>{let N=A1(G,Y),V=A1(j,Y);Q._OrtAddRunConfigEntry(X,N,V)!==0&&p0(`Can't set a run config entry: ${G} - ${j}.`)}),[X,Y]}catch(W){throw X!==0&&Q._OrtReleaseRunOptions(X),Y.forEach((G)=>Q._free(G)),W}}}),kA=Q0(()=>{u8(),sY(),JK=(J)=>{switch(J){case"disabled":return 0;case"basic":return 1;case"extended":return 2;case"all":return 99;default:throw Error(`unsupported graph optimization level: ${J}`)}},QK=(J)=>{switch(J){case"sequential":return 0;case"parallel":return 1;default:throw Error(`unsupported execution mode: ${J}`)}},XK=(J)=>{J.extra||(J.extra={}),J.extra.session||(J.extra.session={});let Q=J.extra.session;Q.use_ort_model_bytes_directly||(Q.use_ort_model_bytes_directly="1"),J.executionProviders&&J.executionProviders.some((X)=>(typeof X=="string"?X:X.name)==="webgpu")&&(J.enableMemPattern=!1)},YK=(J,Q,X)=>{for(let Y of Q){let H=typeof Y=="string"?Y:Y.name;switch(H){case"webnn":if(H="WEBNN",typeof Y!="string"){let G=Y?.deviceType;if(G){let j=A1("deviceType",X),N=A1(G,X);V1()._OrtAddSessionConfigEntry(J,j,N)!==0&&p0(`Can't set a session config entry: 'deviceType' - ${G}.`)}}break;case"webgpu":if(H="JS",typeof Y!="string"){let G=Y;if(G?.preferredLayout){if(G.preferredLayout!=="NCHW"&&G.preferredLayout!=="NHWC")throw Error(`preferredLayout must be either 'NCHW' or 'NHWC': ${G.preferredLayout}`);let j=A1("preferredLayout",X),N=A1(G.preferredLayout,X);V1()._OrtAddSessionConfigEntry(J,j,N)!==0&&p0(`Can't set a session config entry: 'preferredLayout' - ${G.preferredLayout}.`)}}break;case"wasm":case"cpu":continue;default:throw Error(`not supported execution provider: ${H}`)}let W=A1(H,X);V1()._OrtAppendExecutionProvider(J,W)!==0&&p0(`Can't append execution provider: ${H}.`)}},nL=(J)=>{let Q=V1(),X=0,Y=[],H=J||{};XK(H);try{let W=JK(H.graphOptimizationLevel??"all"),G=QK(H.executionMode??"sequential"),j=typeof H.logId=="string"?A1(H.logId,Y):0,N=H.logSeverityLevel??2;if(!Number.isInteger(N)||N<0||N>4)throw Error(`log serverity level is not valid: ${N}`);let V=H.logVerbosityLevel??0;if(!Number.isInteger(V)||V<0||V>4)throw Error(`log verbosity level is not valid: ${V}`);let L=typeof H.optimizedModelFilePath=="string"?A1(H.optimizedModelFilePath,Y):0;if(X=Q._OrtCreateSessionOptions(W,!!H.enableCpuMemArena,!!H.enableMemPattern,G,!!H.enableProfiling,0,j,N,V,L),X===0&&p0("Can't create session options."),H.executionProviders&&YK(X,H.executionProviders,Y),H.enableGraphCapture!==void 0){if(typeof H.enableGraphCapture!="boolean")throw Error(`enableGraphCapture must be a boolean value: ${H.enableGraphCapture}`);let B=A1("enableGraphCapture",Y),U=A1(H.enableGraphCapture.toString(),Y);Q._OrtAddSessionConfigEntry(X,B,U)!==0&&p0(`Can't set a session config entry: 'enableGraphCapture' - ${H.enableGraphCapture}.`)}if(H.freeDimensionOverrides)for(let[B,U]of Object.entries(H.freeDimensionOverrides)){if(typeof B!="string")throw Error(`free dimension override name must be a string: ${B}`);if(typeof U!="number"||!Number.isInteger(U)||U<0)throw Error(`free dimension override value must be a non-negative integer: ${U}`);let E=A1(B,Y);Q._OrtAddFreeDimensionOverride(X,E,U)!==0&&p0(`Can't set a free dimension override: ${B} - ${U}.`)}return H.extra!==void 0&&W4(H.extra,"",new WeakSet,(B,U)=>{let E=A1(B,Y),R=A1(U,Y);Q._OrtAddSessionConfigEntry(X,E,R)!==0&&p0(`Can't set a session config entry: ${B} - ${U}.`)}),[X,Y]}catch(W){throw X!==0&&Q._OrtReleaseSessionOptions(X)!==0&&p0("Can't release session options."),Y.forEach((G)=>Q._free(G)),W}}}),z0=Q0(()=>{Y7=(J)=>{switch(J){case"int8":return 3;case"uint8":return 2;case"bool":return 9;case"int16":return 5;case"uint16":return 4;case"int32":return 6;case"uint32":return 12;case"float16":return 10;case"float32":return 1;case"float64":return 11;case"string":return 8;case"int64":return 7;case"uint64":return 13;case"int4":return 22;case"uint4":return 21;default:throw Error(`unsupported data type: ${J}`)}},g8=(J)=>{switch(J){case 3:return"int8";case 2:return"uint8";case 9:return"bool";case 5:return"int16";case 4:return"uint16";case 6:return"int32";case 12:return"uint32";case 10:return"float16";case 1:return"float32";case 11:return"float64";case 8:return"string";case 7:return"int64";case 13:return"uint64";case 22:return"int4";case 21:return"uint4";default:throw Error(`unsupported data type: ${J}`)}},l8=(J,Q)=>{let X=[-1,4,1,1,2,2,4,8,-1,1,2,8,4,8,-1,-1,-1,-1,-1,-1,-1,0.5,0.5][J],Y=typeof Q=="number"?Q:Q.reduce((H,W)=>H*W,1);return X>0?Math.ceil(Y*X):void 0},aY=(J)=>{switch(J){case"float16":return typeof Float16Array<"u"&&Float16Array.from?Float16Array:Uint16Array;case"float32":return Float32Array;case"uint8":return Uint8Array;case"int8":return Int8Array;case"uint16":return Uint16Array;case"int16":return Int16Array;case"int32":return Int32Array;case"bool":return Uint8Array;case"float64":return Float64Array;case"uint32":return Uint32Array;case"int64":return BigInt64Array;case"uint64":return BigUint64Array;default:throw Error(`unsupported type: ${J}`)}},G4=(J)=>{switch(J){case"verbose":return 0;case"info":return 1;case"warning":return 2;case"error":return 3;case"fatal":return 4;default:throw Error(`unsupported logging level: ${J}`)}},iY=(J)=>J==="float32"||J==="float16"||J==="int32"||J==="int64"||J==="uint32"||J==="uint8"||J==="bool"||J==="uint4"||J==="int4",nY=(J)=>J==="float32"||J==="float16"||J==="int32"||J==="int64"||J==="uint32"||J==="uint64"||J==="int8"||J==="uint8"||J==="bool"||J==="uint4"||J==="int4",wY=(J)=>{switch(J){case"none":return 0;case"cpu":return 1;case"cpu-pinned":return 2;case"texture":return 3;case"gpu-buffer":return 4;case"ml-tensor":return 5;default:throw Error(`unsupported data location: ${J}`)}}}),rL=Q0(()=>{dY(),rY=async(J)=>{if(typeof J=="string"){let Q=await fetch(J);if(!Q.ok)throw Error(`failed to load external data file: ${J}`);let X=Q.headers.get("Content-Length"),Y=X?parseInt(X,10):0;if(Y<1073741824)return new Uint8Array(await Q.arrayBuffer());{if(!Q.body)throw Error(`failed to load external data file: ${J}, no response body.`);let H=Q.body.getReader(),W;try{W=new ArrayBuffer(Y)}catch(j){if(j instanceof RangeError){let N=Math.ceil(Y/65536);W=new WebAssembly.Memory({initial:N,maximum:N}).buffer}else throw j}let G=0;for(;;){let{done:j,value:N}=await H.read();if(j)break;let V=N.byteLength;new Uint8Array(W,G,V).set(N),G+=V}return new Uint8Array(W,0,Y)}}else return J instanceof Blob?new Uint8Array(await J.arrayBuffer()):J instanceof Uint8Array?J:new Uint8Array(J)}}),h6=Q0(()=>{z0(),HK=["V","I","W","E","F"],qK=(J,Q)=>{console.log(`[${HK[J]},${new Date().toISOString()}]${Q}`)},tY=(J,Q)=>{WK=J,GK=Q},jK=(J,Q)=>{let X=G4(J),Y=G4(WK);X>=Y&&qK(X,typeof Q=="function"?Q():Q)},f0=(...J)=>{GK&&jK(...J)}}),tL=Q0(()=>{z0(),eY=(J,Q)=>new(aY(Q))(J)}),JH=Q0(()=>{}),CA=Q0(()=>{h6(),JH(),u3=new Map([[64,250],[128,200],[256,200],[512,200],[2048,230],[4096,200],[8192,50],[16384,50],[32768,50],[65536,50],[131072,50],[262144,50],[524288,50],[1048576,50],[2097152,30],[4194304,20],[8388608,10],[12582912,10],[16777216,10],[26214400,15],[33554432,22],[44236800,2],[58982400,6],[67108864,6],[134217728,6],[167772160,6]]),s5=[],a5=(J)=>Math.ceil(Number(J)/16)*16,FK=(J)=>{for(let Q=0;Q<s5.length;Q++){let X=s5[Q];if(J<=X)return X}return Math.ceil(J/16)*16},NK=1,o3=()=>NK++,kY=async(J,Q,X,Y)=>{let H=a5(X),W=J.device.createBuffer({size:H,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});try{let G=J.getCommandEncoder();J.endComputePass(),G.copyBufferToBuffer(Q,0,W,0,H),J.flush(),await W.mapAsync(GPUMapMode.READ);let j=W.getMappedRange();if(Y){let N=Y();return N.set(new Uint8Array(j,0,X)),N}else return new Uint8Array(j.slice(0,X))}finally{W.destroy()}},VK=class{constructor(J){this.backend=J,this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.buffersPending=[],this.capturedPendingBuffers=new Map;for(let[Q]of u3)s5.push(Q),this.freeBuffers.set(Q,[]),this.freeUniformBuffers.set(Q,[]);this.sessionCount=0}upload(J,Q){let{buffer:X,byteOffset:Y,byteLength:H}=Q,W=a5(H),G=this.storageCache.get(J);if(!G)throw Error("gpu data for uploading does not exist");if(Number(G.originalSize)!==H)throw Error(`inconsistent data size. gpu data size=${G.originalSize}, data size=${H}`);let j=this.backend.device.createBuffer({mappedAtCreation:!0,size:W,usage:GPUBufferUsage.MAP_WRITE|GPUBufferUsage.COPY_SRC}),N=j.getMappedRange();new Uint8Array(N).set(new Uint8Array(X,Y,H)),j.unmap();let V=this.backend.device.createCommandEncoder();V.copyBufferToBuffer(j,0,G.gpuData.buffer,0,W),this.backend.device.queue.submit([V.finish()]),j.destroy(),f0("verbose",()=>`[WebGPU] GpuDataManager.upload(id=${J})`)}memcpy(J,Q){let X=this.storageCache.get(J);if(!X)throw Error("source gpu data for memcpy does not exist");let Y=this.storageCache.get(Q);if(!Y)throw Error("destination gpu data for memcpy does not exist");if(X.originalSize!==Y.originalSize)throw Error("inconsistent source and destination gpu data size");let H=a5(X.originalSize),W=this.backend.getCommandEncoder();this.backend.endComputePass(),W.copyBufferToBuffer(X.gpuData.buffer,0,Y.gpuData.buffer,0,H)}registerExternalBuffer(J,Q,X){let Y;if(X){if(Y=X[0],J===X[1])return f0("verbose",()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${Q}) => id=${Y}, buffer is the same, skip.`),Y;if(this.backend.capturedCommandList.has(this.backend.currentSessionId))throw Error(`Registering a different external buffer under graph capture mode is not supported yet.
             Please use the previous external buffer!`)}else Y=o3();return this.storageCache.set(Y,{gpuData:{id:Y,type:0,buffer:J},originalSize:Q}),f0("verbose",()=>`[WebGPU] GpuDataManager.registerExternalBuffer(size=${Q}) => id=${Y}, registered.`),Y}unregisterExternalBuffer(J){J!==void 0&&(this.storageCache.delete(J),f0("verbose",()=>`[WebGPU] GpuDataManager.unregisterExternalBuffer() => id=${J}`))}create(J,Q=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST){let X=FK(J),Y,H=(Q&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE,W=(Q&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM;if(H||W){let j=(H?this.freeBuffers:this.freeUniformBuffers).get(X);j?j.length>0?Y=j.pop():Y=this.backend.device.createBuffer({size:X,usage:Q}):Y=this.backend.device.createBuffer({size:X,usage:Q})}else Y=this.backend.device.createBuffer({size:X,usage:Q});let G={id:o3(),type:0,buffer:Y};return this.storageCache.set(G.id,{gpuData:G,originalSize:Number(J)}),f0("verbose",()=>`[WebGPU] GpuDataManager.create(size=${J}) => id=${G.id}`),G}get(J){return this.storageCache.get(J)?.gpuData}release(J){let Q=typeof J=="bigint"?Number(J):J,X=this.storageCache.get(Q);if(!X){if(this.storageCache.size===0)return 0;throw Error("releasing data does not exist")}return f0("verbose",()=>`[WebGPU] GpuDataManager.release(id=${Q}), gpuDataId=${X.gpuData.id}`),this.storageCache.delete(Q),this.buffersPending.push(X.gpuData.buffer),X.originalSize}async download(J,Q){let X=this.storageCache.get(Number(J));if(!X)throw Error("data does not exist");await kY(this.backend,X.gpuData.buffer,X.originalSize,Q)}refreshPendingBuffers(){if(this.buffersPending.length!==0)if(this.backend.sessionStatus==="default"){for(let J of this.buffersPending){let Q=u3.get(J.size);if((J.usage&GPUBufferUsage.STORAGE)===GPUBufferUsage.STORAGE){let X=this.freeBuffers.get(J.size)||[];Q===void 0||X.length>=Q?J.destroy():X.push(J)}else if((J.usage&GPUBufferUsage.UNIFORM)===GPUBufferUsage.UNIFORM){let X=this.freeUniformBuffers.get(J.size)||[];Q===void 0||X.length>=Q?J.destroy():X.push(J)}else J.destroy()}this.buffersPending=[]}else{let J=this.capturedPendingBuffers.get(this.backend.currentSessionId);J||(J=[],this.capturedPendingBuffers.set(this.backend.currentSessionId,J));for(let Q of this.buffersPending)J.push(Q);this.buffersPending=[]}}dispose(){this.freeBuffers.forEach((J)=>{J.forEach((Q)=>{Q.destroy()})}),this.freeUniformBuffers.forEach((J)=>{J.forEach((Q)=>{Q.destroy()})}),this.storageCache.forEach((J)=>{J.gpuData.buffer.destroy()}),this.capturedPendingBuffers.forEach((J)=>{J.forEach((Q)=>{Q.destroy()})}),this.storageCache=new Map,this.freeBuffers=new Map,this.freeUniformBuffers=new Map,this.capturedPendingBuffers=new Map}onCreateSession(){this.sessionCount+=1}onReleaseSession(J){let Q=this.capturedPendingBuffers.get(J);Q&&(Q.forEach((X)=>{X.destroy()}),this.capturedPendingBuffers.delete(J)),this.sessionCount-=1,this.sessionCount===0&&(f0("warning",()=>"[WebGPU] Clearing webgpu buffer cache"),this.storageCache.forEach((X)=>{X.gpuData.buffer.destroy()}),this.storageCache=new Map)}},eL=(...J)=>new VK(...J)}),Q1=Q0(()=>{KK=class{constructor(J){Object.assign(this,J)}get cacheKey(){return this.key||(this.key=Object.getOwnPropertyNames(this).sort().map((J)=>`${this[J]}`).join(";")),this.key}},d0=(J)=>new KK(J)}),w0=Q0(()=>{MK=class{static calcMatMulShape(J,Q){return J[1]!==Q[0]?void 0:[J[0],Q[1]]}},q7=class{static calcShape(J,Q,X=!1){let Y=J.length,H=Q.length;if(Y===0)return Q;if(H===0)return J;let W=Math.max(J.length,Q.length),G=Array(W);if(X){if(Y<2||H<2)return;let j=MK.calcMatMulShape([J[Y-2],J[Y-1]],[Q[H-2],Q[H-1]]);if(j===void 0)return;[G[W-2],G[W-1]]=j}for(let j=X?3:1;j<=W;j++){let N=Y-j<0?1:J[Y-j],V=H-j<0?1:Q[H-j];if(N!==V&&N>1&&V>1)return;let L=Math.max(N,V);if(N&&V)G[W-j]=Math.max(N,V);else{if(L>1)return;G[W-j]=0}}return G}static isValidBroadcast(J,Q){let X=J.length,Y=Q.length;if(X>Y)return!1;for(let H=1;H<=X;H++)if(J[X-H]!==1&&J[X-H]!==Q[Y-H])return!1;return!0}},u=class J{static size(Q){return J.getSizeFromDimensionRange(Q,0,Q.length)}static convertShape(Q,X=4){let Y=Q.length;if(Y===0)return[];let H=Array(Y),W=Y-1;for(;W>=0;){if(Q[W]%X===0){H[W]=Q[W]/X;break}if(X%Q[W]!==0)throw Error("cannot convert shape");H[W]=1,X/=Q[W],W--}for(W--;W>=0;W--)H[W]=Q[W];return H}static sizeFromDimension(Q,X){if(X<0||X>Q.length)throw Error(`invalid dimension of ${X} for sizeFromDimension as Tensor has ${Q.length} dimensions.`);return J.getSizeFromDimensionRange(Q,X,Q.length)}static sizeToDimension(Q,X){if(X<0||X>Q.length)throw Error(`invalid dimension of ${X} for sizeToDimension as Tensor has ${Q.length} dimensions.`);return J.getSizeFromDimensionRange(Q,0,X)}static getSizeFromDimensionRange(Q,X,Y){let H=1;for(let W=X;W<Y;W++){if(Q[W]<0)throw Error("cannot get valid size from specified dimension range. Most likely the range contains negative values in them.");H*=Number(Q[W])}return H}static computeStrides(Q){let X=Q.length;if(X===0)return[];if(X===1)return[1];let Y=Array(X);Y[X-1]=1,Y[X-2]=Q[X-1];for(let H=X-3;H>=0;--H)Y[H]=Y[H+1]*Q[H+1];return Y}static normalizeAxis(Q,X){if(Q<-X&&Q>=X)throw Error("unsupported axis for this operation.");return Q<0?Q+X:Q}static normalizeAxes(Q,X){return Q.map((Y)=>this.normalizeAxis(Y,X??Q.length))}static sortBasedOnPerm(Q,X){return X?X.map((Y)=>Q[Y]):Q.slice().reverse()}static padShape(Q,X){let Y=Q.length;return Q.map((H,W)=>H+X[W]+X[W+Y])}static areEqual(Q,X){return Q.length!==X.length?!1:Q.every((Y,H)=>Y===X[H])}},j4=class J{static adjustPoolAttributes(Q,X,Y,H,W,G){if(!Q&&Y.length!==X.length-2)throw Error("length of specified kernel shapes should be 2 less than length of input dimensions");if(Q)for(let j=0;j<X.length-2;j++)j>=Y.length?Y.push(X[j+2]):Y[j]=X[j+2];for(let j=0;j<Y.length;j++)if(j<H.length){if(H[j]<0)throw Error("strides should be greater than or equal to 1")}else H.push(1);for(let j=0;j<Y.length;j++)if(j<W.length){if(W[j]<0)throw Error("dilations should be greater than or equal to 1")}else W.push(1);for(let j=0;j<Y.length*2;j++)if(j<G.length){if(G[j]<0)throw Error("pad should be greater than or equal to 1")}else G.push(0);for(let j=0;j<Y.length;j++){if(Y[j]<=0)throw Error("kernel shapes need to be greater than 0");if(G[j]>=Y[j]||G[j+Y.length]>=Y[j])throw Error("pads should be smaller than kernel")}}static adjustPadsBasedOnAutoPad(Q,X,Y,H,W,G,j){if(j){if(W.length!==2*(Q.length-2))throw Error("length of pads should be twice the length of data dimensions");if(X.length!==Q.length-2)throw Error("length of strides should be the length of data dimensions");if(H.length!==Q.length-2)throw Error("length of kernel shapes should be the length of data dimensions");for(let N=0;N<Q.length-2;N++)J.adjustPadAndReturnShape(Q[N+(G?1:2)],X[N],Y[N],H[N],W,N,N+Q.length-2,j)}}static computePoolOutputShape(Q,X,Y,H,W,G,j){if(X.length<=0)throw Error("input shape must be of size greater than 0");let N=[X[0],X[1]];return J.computeShapeHelper(Q,X,N,Y,H,W,G,j),N}static computeConvOutputShape(Q,X,Y,H,W,G,j){if(Q.length<=0||X.length<=0)throw Error("invalid input tensor dims or invalid filter tensor dims");let N=[Q[0],X[0]];return J.computeShapeHelper(!1,Q,N,Y,H,W,G,j),N}static computeShapeHelper(Q,X,Y,H,W,G,j,N){if(Q)for(let V=0;V<X.length-2;V++)Y.push(1);else for(let V=0;V<X.length-2;V++)Y.push(J.adjustPadAndReturnShape(X[V+2],H[V],W[V],G[V],j,V,V+X.length-2,N))}static adjustPadAndReturnShape(Q,X,Y,H,W,G,j,N){let V=Y*(H-1)+1;if(N&&N!=="NOTSET")switch(N){case"VALID":return W[G]=0,W[j]=0,Math.floor((Q-V)/X+1);case"SAME_LOWER":case"SAME_UPPER":if(Y!==1)throw Error("Dilation not supported for SAME_UPPER or SAME_LOWER");{let L=((Q+X-1)/X-1)*X+H-Q;return W[G]=Math.floor(N==="SAME_LOWER"?(L+1)/2:L/2),W[j]=L-W[G],Math.floor((Q+L-H)/X+1)}default:throw Error("Unsupported AutoPad type")}else return Math.floor((Q+W[G]+W[j]-V)/X+1)}},JU=class{static getShapeOfGemmResult(J,Q,X,Y,H){if(J.length!==2||X.length!==2)throw Error("shape need to be of size 2");let W,G,j;Q?(W=J[1],G=J[0]):(W=J[0],G=J[1]);let N=-1;if(Y?(j=X[0],N=1):(j=X[1],N=0),X[N]!==G)throw Error("dimension mismatch");if(W<=0||j<=0||G<=0)throw Error("invalid shape specified");if(H&&!q7.isValidBroadcast(H,[W,j]))throw Error("gemm: invalid bias shape for broadcast");return[W,j,G]}},QU=-340282346638528860000000000000000000000,XU=340282346638528860000000000000000000000}),I0=Q0(()=>{z0(),w0(),W7=64,i5=(J,Q)=>{if(Q===3)throw Error("vec3 has same alignment as vec4, use vec4 instead");switch(Number(J)){case 10:return Q>1?`vec${Q}<f16>`:"f16";case 1:return Q>1?`vec${Q}<f32>`:"f32";case 6:return Q>1?`vec${Q}<i32>`:"i32";case 12:return Q>1?`vec${Q}<u32>`:"u32";case 7:if(Q>1)throw Error("currently not supported vecX of uint64 yet");return["vec2<u32>","i32"];case 13:if(Q>1)throw Error("currently not supported vecX of uint64 yet");return["vec2<u32>","u32"];case 9:if(Q!==4)throw Error("bool must be vec4");return["u32","vec4<bool>"];case 22:return"i32";case 21:return"u32";default:throw Error(`Unknown data type: ${J}`)}},K1=(J,Q=1)=>{let X=i5(J,Q);return typeof X=="string"?X:X[0]},P1=(J,Q=1)=>{let X=i5(J,Q);return typeof X=="string"?X:X[1]},R0=(...J)=>{let Q=[];return J.forEach((X)=>{X.length!==0&&Q.push({type:12,data:X},{type:12,data:u.computeStrides(X)})}),Q},e0=(J)=>J%4===0?4:J%2===0?2:1,CY=(J="f32",Q,X="0")=>!Q||Q===1?`${J}(${X})`:`vec${Q}<${J}>(${X})`,H7=(J,Q,X)=>J==="f32"?X:Q===1?`f32(${X})`:`vec${Q}<f32>(${X})`,i6=(J,Q)=>Q===4?`(${J}.x + ${J}.y + ${J}.z + ${J}.w)`:Q===2?`(${J}.x + ${J}.y)`:Q===3?`(${J}.x + ${J}.y + ${J}.z)`:J,U0=(J,Q,X,Y)=>J.startsWith("uniforms.")&&X>4?typeof Q=="string"?Y==="f16"?`${J}[(${Q}) / 8][(${Q}) % 8 / 4][(${Q}) % 8 % 4]`:`${J}[(${Q}) / 4][(${Q}) % 4]`:Y==="f16"?`${J}[${Math.floor(Q/8)}][${Math.floor(Q%8/4)}][${Q%8%4}]`:`${J}[${Math.floor(Q/4)}][${Q%4}]`:X>1?`${J}[${Q}]`:J,l2=(J,Q,X,Y,H)=>{let W=typeof X=="number",G=W?X:X.length,j=[...Array(G).keys()],N=G<2?"u32":G<=4?`vec${G}<u32>`:`array<u32, ${G}>`,V=i5(Q,H),L=typeof V=="string"?V:V[1],B=typeof V=="string"?V:V[0],U={indices:N,value:L,storage:B,tensor:Q},E=(f)=>typeof f=="string"?f:`${f}u`,R={offsetToIndices:!1,indicesToOffset:!1,broadcastedIndicesToOffset:!1,set:!1,setByIndices:!1,get:!1,getByIndices:!1},A=W?"uniforms.":"",P=`${A}${J}_shape`,z=`${A}${J}_strides`,D="";for(let f=0;f<G-1;f++)D+=`
    let dim${f} = current / ${U0(z,f,G)};
    let rest${f} = current % ${U0(z,f,G)};
    indices[${f}] = dim${f};
    current = rest${f};
    `;D+=`indices[${G-1}] = current;`;let S=G<2?"":`
  fn o2i_${J}(offset: u32) -> ${U.indices} {
    var indices: ${U.indices};
    var current = offset;
    ${D}
    return indices;
  }`,w=(f)=>(R.offsetToIndices=!0,G<2?f:`o2i_${J}(${f})`),k=[];if(G>=2)for(let f=G-1;f>=0;f--)k.push(`${U0(z,f,G)} * (indices[${f}])`);let I=G<2?"":`
  fn i2o_${J}(indices: ${U.indices}) -> u32 {
    return ${k.join("+")};
  }`,C=(f)=>(R.indicesToOffset=!0,G<2?f:`i2o_${J}(${f})`),T=(...f)=>G===0?"0u":`${U.indices}(${f.map(E).join(",")})`,g=(f,p)=>G<2?`${f}`:`${U0(f,p,G)}`,m=(f,p,v)=>G<2?`${f}=${v};`:`${U0(f,p,G)}=${v};`,l={},t=(f,p)=>{R.broadcastedIndicesToOffset=!0;let v=`${p.name}broadcastedIndicesTo${J}Offset`;if(v in l)return`${v}(${f})`;let r=[];for(let k0=G-1;k0>=0;k0--){let o0=p.indicesGet("outputIndices",k0+p.rank-G);r.push(`${g(z,k0)} * (${o0} % ${g(P,k0)})`)}return l[v]=`fn ${v}(outputIndices: ${p.type.indices}) -> u32 {
             return ${r.length>0?r.join("+"):"0u"};
           }`,`${v}(${f})`},h=(f,p)=>(()=>{if(U.storage===U.value)return`${J}[${f}]=${p};`;if(U.storage==="vec2<u32>"&&U.value==="i32")return`${J}[${f}]=vec2<u32>(u32(${p}), select(0u, 0xFFFFFFFFu, ${p} < 0));`;if(U.storage==="vec2<u32>"&&U.value==="u32")return`${J}[${f}]=vec2<u32>(u32(${p}), 0u);`;if(U.storage==="u32"&&U.value==="vec4<bool>")return`${J}[${f}]=dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(${p}));`;throw Error(`not supported combination of storage type ${U.storage} and value type ${U.value} yet`)})(),W0=(f)=>(()=>{if(U.storage===U.value)return`${J}[${f}]`;if(U.storage==="vec2<u32>"&&U.value==="i32")return`i32(${J}[${f}].x)`;if(U.storage==="vec2<u32>"&&U.value==="u32")return`u32(${J}[${f}].x)`;if(U.storage==="u32"&&U.value==="vec4<bool>")return`vec4<bool>(bool(${J}[${f}] & 0xFFu), bool(${J}[${f}] & 0xFF00u), bool(${J}[${f}] & 0xFF0000u), bool(${J}[${f}] & 0xFF000000u))`;throw Error(`not supported combination of storage type ${U.storage} and value type ${U.value} yet`)})(),j0=G<2?"":`
  fn get_${J}ByIndices(indices: ${U.indices}) -> ${L} {
    return ${W0(`i2o_${J}(indices)`)};
  }`,o=G<2?"":(()=>{let f=j.map((v)=>`d${v}: u32`).join(", "),p=j.map((v)=>`d${v}`).join(", ");return`
  fn get_${J}(${f}) -> ${L} {
    return get_${J}ByIndices(${T(p)});
  }`})(),G0=(...f)=>{if(f.length!==G)throw Error(`indices length must be ${G}`);let p=f.map(E).join(",");return G===0?W0("0u"):G===1?W0(p[0]):(R.get=!0,R.getByIndices=!0,R.indicesToOffset=!0,`get_${J}(${p})`)},F0=(f)=>G<2?W0(f):(R.getByIndices=!0,R.indicesToOffset=!0,`get_${J}ByIndices(${f})`),s=G<2?"":`
  fn set_${J}ByIndices(indices: ${U.indices}, value: ${L}) {
    ${h(`i2o_${J}(indices)`,"value")}
  }`,N0=G<2?"":(()=>{let f=j.map((v)=>`d${v}: u32`).join(", "),p=j.map((v)=>`d${v}`).join(", ");return`
  fn set_${J}(${f}, value: ${L}) {
    set_${J}ByIndices(${T(p)}, value);
  }`})();return{impl:()=>{let f=[],p=!1;return R.offsetToIndices&&(f.push(S),p=!0),R.indicesToOffset&&(f.push(I),p=!0),R.broadcastedIndicesToOffset&&(Object.values(l).forEach((v)=>f.push(v)),p=!0),R.set&&(f.push(N0),p=!0),R.setByIndices&&(f.push(s),p=!0),R.get&&(f.push(o),p=!0),R.getByIndices&&(f.push(j0),p=!0),!W&&p&&f.unshift(`const ${P} = ${U.indices}(${X.join(",")});`,`const ${z} = ${U.indices}(${u.computeStrides(X).join(",")});`),f.join(`
`)},type:U,offsetToIndices:w,indicesToOffset:C,broadcastedIndicesToOffset:t,indices:T,indicesGet:g,indicesSet:m,set:(...f)=>{if(f.length!==G+1)throw Error(`indices length must be ${G}`);let p=f[G];if(typeof p!="string")throw Error("value must be string");let v=f.slice(0,G).map(E).join(",");return G===0?h("0u",p):G===1?h(v[0],p):(R.set=!0,R.setByIndices=!0,R.indicesToOffset=!0,`set_${J}(${v}, ${p})`)},setByOffset:h,setByIndices:(f,p)=>G<2?h(f,p):(R.setByIndices=!0,R.indicesToOffset=!0,`set_${J}ByIndices(${f}, ${p});`),get:G0,getByOffset:W0,getByIndices:F0,usage:Y,name:J,strides:z,shape:P,rank:G}},i=(J,Q,X,Y=1)=>l2(J,Q,X,"input",Y),B0=(J,Q,X,Y=1)=>l2(J,Q,X,"output",Y),YU=(J,Q,X)=>l2(J,Q,X,"atomicOutput",1),QH=(J,Q,X,Y=1)=>l2(J,Q,X,"internal",Y),BK=class{constructor(J,Q){this.normalizedDispatchGroup=J,this.limits=Q,this.internalVariables=[],this.variables=[],this.uniforms=[],this.variableIndex=0}guardAgainstOutOfBoundsWorkgroupSizes(J){return`if (global_idx >= ${typeof J=="number"?`${J}u`:J}) { return; }`}mainStart(J=W7){let Q=typeof J=="number"?J:J[0],X=typeof J=="number"?1:J[1],Y=typeof J=="number"?1:J[2];if(Q>this.limits.maxComputeWorkgroupSizeX||X>this.limits.maxComputeWorkgroupSizeY||Y>this.limits.maxComputeWorkgroupSizeZ)throw Error(`workgroup size [${Q}, ${X}, ${Y}] exceeds the maximum workgroup size [${this.limits.maxComputeWorkgroupSizeX}, ${this.limits.maxComputeWorkgroupSizeY}, ${this.limits.maxComputeWorkgroupSizeZ}].`);if(Q*X*Y>this.limits.maxComputeInvocationsPerWorkgroup)throw Error(`workgroup size [${Q}, ${X}, ${Y}] exceeds the maximum workgroup invocations ${this.limits.maxComputeInvocationsPerWorkgroup}.`);let H=this.normalizedDispatchGroup[1]===1&&this.normalizedDispatchGroup[2]===1,W=H?`@builtin(global_invocation_id) global_id : vec3<u32>,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(local_invocation_id) local_id : vec3<u32>`:`@builtin(global_invocation_id) global_id : vec3<u32>,
                                             @builtin(local_invocation_id) local_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(num_workgroups) num_workgroups : vec3<u32>`,G=H?`let global_idx = global_id.x;
         let workgroup_index = workgroup_id.x;`:`let workgroup_index = workgroup_id.z * num_workgroups[0] * num_workgroups[1] +
             workgroup_id.y * num_workgroups[0] + workgroup_id.x;
         let global_idx = workgroup_index * ${Q*X*Y}u + local_idx;`;return`@compute @workgroup_size(${Q}, ${X}, ${Y})
  fn main(${W}) {
    ${G}
  `}appendVariableUniforms(J){J.rank!==0&&(J.shape.startsWith("uniforms.")&&this.uniforms.push({name:J.shape.replace("uniforms.",""),type:"u32",length:J.rank}),J.strides.startsWith("uniforms.")&&this.uniforms.push({name:J.strides.replace("uniforms.",""),type:"u32",length:J.rank}))}declareVariable(J,Q){if(J.usage==="internal")throw Error("cannot use internal variable with declareVariable(). use registerInternalVariables() instead.");this.variables.push(J),this.appendVariableUniforms(J);let X=J.usage==="input"?"read":"read_write",Y=J.usage==="atomicOutput"?"atomic<i32>":J.type.storage;return`@group(0) @binding(${Q}) var<storage, ${X}> ${J.name}: array<${Y}>;`}declareVariables(...J){return J.map((Q)=>this.declareVariable(Q,this.variableIndex++)).join(`
`)}registerInternalVariable(J){if(J.usage!=="internal")throw Error("cannot use input or output variable with registerInternalVariable(). use declareVariables() instead.");this.internalVariables.push(J),this.appendVariableUniforms(J)}registerInternalVariables(...J){return J.forEach((Q)=>this.registerInternalVariable(Q)),this}registerUniform(J,Q,X=1){return this.uniforms.push({name:J,type:Q,length:X}),this}registerUniforms(J){return this.uniforms=this.uniforms.concat(J),this}uniformDeclaration(){if(this.uniforms.length===0)return"";let J=[];for(let{name:Q,type:X,length:Y}of this.uniforms)if(Y&&Y>4)X==="f16"?J.push(`@align(16) ${Q}:array<mat2x4<${X}>, ${Math.ceil(Y/8)}>`):J.push(`${Q}:array<vec4<${X}>, ${Math.ceil(Y/4)}>`);else{let H=Y==null||Y===1?X:`vec${Y}<${X}>`;J.push(`${Q}:${H}`)}return`
      struct Uniforms { ${J.join(", ")} };
      @group(0) @binding(${this.variableIndex}) var<uniform> uniforms: Uniforms;`}get additionalImplementations(){return this.uniformDeclaration()+this.variables.map((J)=>J.impl()).join(`
`)+this.internalVariables.map((J)=>J.impl()).join(`
`)}get variablesInfo(){if(this.uniforms.length===0)return;let J=(Q)=>[12,10,1,6][["u32","f16","f32","i32"].indexOf(Q)];return this.uniforms.map((Q)=>[J(Q.type),Q.length??1])}},HU=(J,Q)=>new BK(J,Q)}),n6=Q0(()=>{z0(),w0(),Q1(),I0(),LK=(J,Q)=>{if(!J||J.length!==1)throw Error("Transpose requires 1 input.");if(Q.length!==0&&Q.length!==J[0].dims.length)throw Error(`perm size ${Q.length} does not match input rank ${J[0].dims.length}`)},s3=(J,Q)=>Q.length!==0?Q:[...Array(J).keys()].reverse(),UK=(J,Q)=>u.sortBasedOnPerm(J,s3(J.length,Q)),OK=(J,Q,X,Y)=>{let H=`fn perm(i: ${Y.type.indices}) -> ${X.type.indices} {
    var a: ${X.type.indices};`;for(let W=0;W<Q;++W)H+=`a[${J[W]}]=i[${W}];`;return H+="return a;}"},RK=(J,Q)=>{let X=[],Y=[];for(let H=0;H<J.length;++H)J[H]!==1&&X.push(J[H]),J[Q[H]]!==1&&Y.push(Q[H]);return{newShape:X,newPerm:Y}},EK=(J,Q)=>{let X=0;for(let Y=0;Y<J.length;++Y)if(Q[J[Y]]!==1){if(J[Y]<X)return!1;X=J[Y]}return!0},y1=(J,Q)=>{let X=J.dataType,Y=J.dims.length,H=s3(Y,Q),W=UK(J.dims,H),G=J.dims,j=W,N=Y<2||EK(H,J.dims),V;if(N)return V=(R)=>{let A=i("input",X,G,4),P=B0("output",X,j,4);return`
  ${R.registerUniform("output_size","u32").declareVariables(A,P)}
  ${R.mainStart()}
    ${R.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    output[global_idx] = input[global_idx];
  }`},{name:"TransposeCopy",shaderCache:{inputDependencies:["type"]},getRunData:()=>{let R=u.size(W);return{outputs:[{dims:W,dataType:J.dataType}],dispatchGroup:{x:Math.ceil(R/64/4)},programUniforms:[{type:12,data:Math.ceil(R/4)}]}},getShaderSource:V};let{newShape:L,newPerm:B}=RK(J.dims,H),U=u.areEqual(B,[2,3,1]),E=u.areEqual(B,[3,1,2]);if(L.length===2||U||E){G=U?[L[0],L[1]*L[2]]:E?[L[0]*L[1],L[2]]:L,j=[G[1],G[0]];let R=16;return V=(A)=>{let P=i("a",X,G.length),z=B0("output",X,j.length);return`
  ${A.registerUniform("output_size","u32").declareVariables(P,z)}
  var<workgroup> tile : array<array<${z.type.value}, ${R+1}>, ${R}>;
  ${A.mainStart([R,R,1])}
    let stride = (uniforms.output_shape[1] - 1) / ${R} + 1;
    let workgroup_id_x = workgroup_index % stride;
    let workgroup_id_y = workgroup_index / stride;
    let input_col = workgroup_id_y * ${R}u + local_id.x;
    let input_row = workgroup_id_x * ${R}u + local_id.y;
    if (input_row < uniforms.a_shape[0] && input_col < uniforms.a_shape[1]) {
      tile[local_id.y][local_id.x] = ${P.getByIndices(`${P.type.indices}(input_row, input_col)`)};
    }
    workgroupBarrier();

    let output_col = workgroup_id_x * ${R}u + local_id.x;
    let output_row = workgroup_id_y * ${R}u + local_id.y;
    if (output_row < uniforms.output_shape[0] && output_col < uniforms.output_shape[1]) {
      ${z.setByIndices(`${z.type.indices}(output_row, output_col)`,"tile[local_id.x][local_id.y]")}
    }
  }`},{name:"TransposeShared",shaderCache:{inputDependencies:["type"]},getRunData:()=>{let A=u.size(W);return{outputs:[{dims:W,dataType:J.dataType}],dispatchGroup:{x:Math.ceil(j[1]/R),y:Math.ceil(j[0]/R)},programUniforms:[{type:12,data:A},...R0(G,j)]}},getShaderSource:V}}return V=(R)=>{let A=i("a",X,G.length),P=B0("output",X,j.length);return`
  ${R.registerUniform("output_size","u32").declareVariables(A,P)}

  ${OK(H,Y,A,P)}

  ${R.mainStart()}
    ${R.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${P.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${P.setByOffset("global_idx",A.getByIndices("aIndices"))}
  }`},{name:"Transpose",shaderCache:{hint:`${Q}`,inputDependencies:["rank"]},getRunData:()=>{let R=u.size(W);return{outputs:[{dims:W,dataType:J.dataType}],dispatchGroup:{x:Math.ceil(R/64)},programUniforms:[{type:12,data:R},...R0(G,j)]}},getShaderSource:V}},qU=(J,Q)=>{LK(J.inputs,Q.perm),J.compute(y1(J.inputs[0],Q.perm))},WU=(J)=>d0({perm:J.perm})}),IA=Q0(()=>{z0(),w0(),I0(),XH(),n6(),DK={max:"select(bestValue, candidate, candidate > bestValue)",min:"select(bestValue, candidate, candidate < bestValue)",mean:"bestValue + candidate",sum:"bestValue + candidate",prod:"bestValue * candidate",sumSquare:"bestValue + candidate * candidate",logSumExp:"bestValue + exp(candidate)",l1:"bestValue + abs(candidate)",l2:"bestValue + candidate * candidate",logSum:"bestValue + candidate"},AK={max:"select(bestValue, candidate, candidate > bestValue)",min:"select(bestValue, candidate, candidate < bestValue)",mean:"bestValue + candidate",sum:"bestValue + candidate",prod:"bestValue * candidate",sumSquare:"bestValue + candidate",logSumExp:"bestValue + candidate",l1:"bestValue + candidate",l2:"bestValue + candidate",logSum:"bestValue + candidate"},zK={max:"_A[offset]",min:"_A[offset]",mean:"0",sum:"0",prod:"1",sumSquare:"0",logSumExp:"0",l1:"0",l2:"0",logSum:"0"},$K={max:"bestValue",min:"bestValue",sum:"bestValue",prod:"bestValue",sumSquare:"bestValue",logSumExp:"log(bestValue)",l1:"bestValue",l2:"sqrt(bestValue)",logSum:"log(bestValue)"},PK=(J,Q)=>{let X=[];for(let Y=Q-J;Y<Q;++Y)X.push(Y);return X},SK=(J,Q)=>{let X=[],Y=J.length;for(let W=0;W<Y;W++)Q.indexOf(W)===-1&&X.push(J[W]);let H=Q.map((W)=>J[W]);return[X,H]},ZK=(J,Q)=>{let X=J.length+Q.length,Y=[],H=0;for(let W=0;W<X;W++)Q.indexOf(W)===-1?Y.push(J[H++]):Y.push(1);return Y},wK=(J,Q)=>{for(let X=0;X<J.length;++X)if(J[J.length-X-1]!==Q-1-X)return!1;return!0},kK=(J,Q)=>{let X=[];if(!wK(J,Q)){for(let Y=0;Y<Q;++Y)J.indexOf(Y)===-1&&X.push(Y);J.forEach((Y)=>X.push(Y))}return X},CK=(J,Q,X,Y,H,W,G)=>{let j=X[0].dims,N=u.size(W),V=u.size(G),L=i("_A",X[0].dataType,j),B=B0("output",H,W),U=64;N===1&&(U=256);let E=`
          var<workgroup> aBestValues : array<f32, ${U}>;
       `,R=(A)=>`
        ${A.registerUniform("reduceSize","u32").declareVariables(L,B)}
        ${E}
        fn DIV_CEIL(a : u32, b : u32) -> u32 {
          return ((a - 1u) / b + 1u);
         }
         ${A.mainStart(U)}

          let outputIndex = global_idx / ${U};
          let offset = outputIndex * uniforms.reduceSize;

          var bestValue = f32(${zK[Y]});
          let Length = uniforms.reduceSize;
          for (var k = local_idx; k < Length; k = k + ${U}) {
           let candidate = f32(${L.getByOffset("offset + k")});
           bestValue = ${DK[Y]};
          }
          aBestValues[local_idx] = bestValue;
          workgroupBarrier();

         var reduceSize = min(Length, ${U}u);
         for (var currentSize = reduceSize / 2u; reduceSize > 1u;
             currentSize = reduceSize / 2u) {
           let interval = DIV_CEIL(reduceSize, 2u);
           if (local_idx < currentSize) {
            let candidate = aBestValues[local_idx + interval];
            bestValue = ${AK[Y]};
            aBestValues[local_idx] = bestValue;
           }
           reduceSize = interval;
           workgroupBarrier();
         }

         if (local_idx == 0u) {
          ${B.setByOffset("outputIndex",`${Y==="mean"?`${B.type.storage}(bestValue / f32(uniforms.reduceSize))`:`${B.type.storage}(${$K[Y]})`}`)};
         }
        }`;return{name:J,shaderCache:{hint:`${Q};${U}`,inputDependencies:["type"]},getShaderSource:R,getRunData:()=>({outputs:[{dims:W,dataType:H}],dispatchGroup:{x:N},programUniforms:[{type:12,data:V}]})}},W6=(J,Q,X,Y)=>{let H=J.inputs.length===1?X:IY(J.inputs,X),W=H.axes;W.length===0&&!H.noopWithEmptyAxes&&(W=J.inputs[0].dims.map((E,R)=>R));let G=u.normalizeAxes(W,J.inputs[0].dims.length),j=G,N=J.inputs[0],V=kK(j,J.inputs[0].dims.length);V.length>0&&(N=J.compute(y1(J.inputs[0],V),{inputs:[0],outputs:[-1]})[0],j=PK(j.length,N.dims.length));let[L,B]=SK(N.dims,j),U=L;H.keepDims&&(U=ZK(L,G)),J.compute(CK(Q,H.cacheKey,[N],Y,J.inputs[0].dataType,U,B),{inputs:[N]})},GU=(J,Q)=>{W6(J,"ReduceMeanShared",Q,"mean")},jU=(J,Q)=>{W6(J,"ReduceL1Shared",Q,"l1")},FU=(J,Q)=>{W6(J,"ReduceL2Shared",Q,"l2")},NU=(J,Q)=>{W6(J,"ReduceLogSumExpShared",Q,"logSumExp")},VU=(J,Q)=>{W6(J,"ReduceMaxShared",Q,"max")},KU=(J,Q)=>{W6(J,"ReduceMinShared",Q,"min")},MU=(J,Q)=>{W6(J,"ReduceProdShared",Q,"prod")},BU=(J,Q)=>{W6(J,"ReduceSumShared",Q,"sum")},LU=(J,Q)=>{W6(J,"ReduceSumSquareShared",Q,"sumSquare")},UU=(J,Q)=>{W6(J,"ReduceLogSumShared",Q,"logSum")}}),XH=Q0(()=>{z0(),w0(),Q1(),I0(),IA(),G6=(J)=>{if(!J||J.length===0||J.length>2)throw Error("Reduce op requires 1 or 2 inputs.");if(J.length===2&&J[1].dims.length!==1)throw Error("Invalid axes input dims.")},IK=(J)=>["","",`var value = ${J.getByIndices("input_indices")};`,""],F4=(J,Q,X,Y,H,W,G=!1,j=!1)=>{let N=[],V=X[0].dims,L=V.length,B=u.normalizeAxes(H,L),U=!j&&B.length===0;V.forEach((A,P)=>{U||B.indexOf(P)>=0?G&&N.push(1):N.push(A)});let E=N.length,R=u.size(N);return{name:J,shaderCache:Q,getShaderSource:(A)=>{let P=[],z=i("_A",X[0].dataType,L),D=B0("output",W,E),S=Y(z,D,B),w=S[2];for(let k=0,I=0;k<L;k++)U||B.indexOf(k)>=0?(G&&I++,w=`for(var j${k}: u32 = 0; j${k} < ${V[k]}; j${k}++) {
                  ${S[2].includes("last_index")?`let last_index = j${k};`:""}
                  ${z.indicesSet("input_indices",k,`j${k}`)}
                  ${w}
                }`):(P.push(`${z.indicesSet("input_indices",k,D.indicesGet("output_indices",I))};`),I++);return`

        ${A.registerUniform("output_size","u32").declareVariables(z,D)}

        ${A.mainStart()}
          ${A.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          var input_indices: ${z.type.indices};
          let output_indices = ${D.offsetToIndices("global_idx")};

          ${P.join(`
`)}
          ${S[0]}       // init ops for reduce max/min
          ${S[1]}
          ${w}
          ${S[3]}
          ${S.length===4?D.setByOffset("global_idx","value"):S.slice(4).join(`
`)}
        }`},getRunData:()=>({outputs:[{dims:N,dataType:W}],dispatchGroup:{x:Math.ceil(R/64)},programUniforms:[{type:12,data:R},...R0(V,N)]})}},IY=(J,Q)=>{let X=[];return J[1].dims[0]>0&&J[1].getBigInt64Array().forEach((Y)=>X.push(Number(Y))),d0({axes:X,keepDims:Q.keepDims,noopWithEmptyAxes:Q.noopWithEmptyAxes})},j6=(J,Q,X,Y)=>{let H=J.inputs,W=H.length===1?X:IY(H,X);J.compute(F4(Q,{hint:W.cacheKey,inputDependencies:["rank"]},[H[0]],W.noopWithEmptyAxes&&W.axes.length===0?IK:Y,W.axes,H[0].dataType,W.keepDims,W.noopWithEmptyAxes),{inputs:[0]})},_K=(J,Q)=>{G6(J.inputs),j6(J,"ReduceLogSum",Q,(X,Y)=>[`var value = ${Y.type.storage}(0);`,"",`value += ${X.getByIndices("input_indices")};`,"value = log(value);"])},bK=(J,Q)=>{G6(J.inputs),j6(J,"ReduceL1",Q,(X,Y)=>[`var value = ${Y.type.storage}(0);`,"",`value += abs(${X.getByIndices("input_indices")});`,""])},vK=(J,Q)=>{G6(J.inputs),j6(J,"ReduceL2",Q,(X,Y)=>[`var t = ${Y.type.value}(0); var value = ${Y.type.value}(0);`,"",`t = ${X.getByIndices("input_indices")}; value += (t * t);`,"value = sqrt(value);"])},TK=(J,Q)=>{G6(J.inputs),j6(J,"ReduceLogSumExp",Q,(X,Y)=>[`var value = ${Y.type.storage}(0);`,"",`value += exp(${X.getByIndices("input_indices")});`,"value = log(value);"])},xK=(J,Q)=>{G6(J.inputs),j6(J,"ReduceMax",Q,(X,Y,H)=>{let W=[];for(let G=0;G<X.rank;G++)(H.indexOf(G)>=0||H.length===0)&&W.push(X.indicesSet("input_indices",G,0));return[`${W.join(`
`)}`,`var value = ${X.getByIndices("input_indices")};`,`value = max(value, ${X.getByIndices("input_indices")});`,""]})},fK=(J,Q)=>{G6(J.inputs),j6(J,"ReduceMean",Q,(X,Y,H)=>{let W=1;for(let G=0;G<X.rank;G++)(H.indexOf(G)>=0||H.length===0)&&(W*=J.inputs[0].dims[G]);return["var sum = f32(0);","",`sum += f32(${X.getByIndices("input_indices")});`,`let value = ${Y.type.value}(sum / ${W});`]})},hK=(J,Q)=>{G6(J.inputs),j6(J,"ReduceMin",Q,(X,Y,H)=>{let W=[];for(let G=0;G<X.rank;G++)(H.indexOf(G)>=0||H.length===0)&&W.push(`input_indices[${G}] = 0;`);return[`${W.join(`
`)}`,`var value = ${X.getByIndices("input_indices")};`,`value = min(value, ${X.getByIndices("input_indices")});`,""]})},yK=(J,Q)=>{G6(J.inputs),j6(J,"ReduceProd",Q,(X,Y)=>[`var value = ${Y.type.storage}(1);`,"",`value *= ${X.getByIndices("input_indices")};`,""])},gK=(J,Q)=>{G6(J.inputs),j6(J,"ReduceSum",Q,(X,Y)=>[`var value = ${Y.type.storage}(0);`,"",`value += ${X.getByIndices("input_indices")};`,""])},lK=(J,Q)=>{G6(J.inputs),j6(J,"ReduceSumSquare",Q,(X,Y)=>[`var t = ${Y.type.value}(0); var value = ${Y.type.value}(0);`,"",`t = ${X.getByIndices("input_indices")}; value += t * t;`,""])},F6=(J,Q,X)=>{if(Q.length===0)return X;let Y=1,H=1;for(let W=0;W<Q.length;W++)Q.indexOf(W)===-1?Y*=J[W]:H*=J[W];return H<32&&Y>1024},OU=(J,Q)=>{F6(J.inputs[0].dims,Q.axes,Q.noopWithEmptyAxes)?fK(J,Q):GU(J,Q)},RU=(J,Q)=>{F6(J.inputs[0].dims,Q.axes,Q.noopWithEmptyAxes)?bK(J,Q):jU(J,Q)},EU=(J,Q)=>{F6(J.inputs[0].dims,Q.axes,Q.noopWithEmptyAxes)?vK(J,Q):FU(J,Q)},DU=(J,Q)=>{F6(J.inputs[0].dims,Q.axes,Q.noopWithEmptyAxes)?TK(J,Q):NU(J,Q)},AU=(J,Q)=>{F6(J.inputs[0].dims,Q.axes,Q.noopWithEmptyAxes)?xK(J,Q):VU(J,Q)},zU=(J,Q)=>{F6(J.inputs[0].dims,Q.axes,Q.noopWithEmptyAxes)?hK(J,Q):KU(J,Q)},$U=(J,Q)=>{F6(J.inputs[0].dims,Q.axes,Q.noopWithEmptyAxes)?yK(J,Q):MU(J,Q)},PU=(J,Q)=>{F6(J.inputs[0].dims,Q.axes,Q.noopWithEmptyAxes)?gK(J,Q):BU(J,Q)},SU=(J,Q)=>{F6(J.inputs[0].dims,Q.axes,Q.noopWithEmptyAxes)?lK(J,Q):LU(J,Q)},ZU=(J,Q)=>{F6(J.inputs[0].dims,Q.axes,Q.noopWithEmptyAxes)?_K(J,Q):UU(J,Q)}}),_A=Q0(()=>{z0(),Q1(),XH(),a3=(J)=>{if(!J||J.length===0||J.length>2)throw Error("ArgMinMaxOp op requires 1 or 2 inputs.");if(J[0].dataType!==1)throw Error("Invalid input type.")},wU=(J,Q)=>{a3(J.inputs);let X=(Y,H,W)=>{let G=[];for(let j=0;j<Y.rank;j++)(W.indexOf(j)>=0||W.length===0)&&G.push(`input_indices[${j}] = 0;`);return[`${G.join(`
`)}`,`var value = ${Y.getByIndices("input_indices")};
var best_index : i32 = 0;`,`if (${Y.getByIndices("input_indices")} ${Q.selectLastIndex>0?"<=":"<"} value) {
         value = ${Y.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`,"",H.setByOffset("global_idx","best_index")]};J.compute(F4("ArgMin",{hint:Q.cacheKey,inputDependencies:["rank"]},[J.inputs[0]],X,[Q.axis],7,Q.keepDims),{inputs:[0]})},kU=(J,Q)=>{a3(J.inputs);let X=(Y,H,W)=>{let G=[];for(let j=0;j<Y.rank;j++)(W.indexOf(j)>=0||W.length===0)&&G.push(`input_indices[${j}] = 0;`);return[`${G.join(`
`)}`,`var value = ${Y.getByIndices("input_indices")};
var best_index : i32 = 0;`,`if (${Y.getByIndices("input_indices")} ${Q.selectLastIndex>0?">=":">"} value) {
         value = ${Y.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`,"",H.setByOffset("global_idx","best_index")]};J.compute(F4("argMax",{hint:Q.cacheKey,inputDependencies:["rank"]},[J.inputs[0]],X,[Q.axis],7,Q.keepDims),{inputs:[0]})},_Y=(J)=>d0(J)}),YH=Q0(()=>{z0(),w0(),JH(),I0(),mK=(J,Q)=>{let X=J[0],Y=J[1],H=J[2],W=J[3],G=J[4],j=J[5];if(G&&j)throw Error("Attention cannot have both past and attention_bias");if(X.dims.length!==3)throw Error('Input "input" must have 3 dimensions');let N=X.dims[0],V=X.dims[1],L=X.dims[2];if(H.dims.length!==1)throw Error('Input "bias" is expected to have 1 dimensions');if(Y.dims.length!==2)throw Error('Input "weights" is expected to have 2 dimensions');if(Y.dims[0]!==L)throw Error("Input 1 dimension 0 should have same length as dimension 2 of input 0");if(H.dims[0]!==Y.dims[1])throw Error('Input "bias" dimension 0 should have same length as dimension 1 of input "weights"');let B=H.dims[0]/3,U=B,E=U;if(Q.qkvHiddenSizes.length>0){if(Q.qkvHiddenSizes.length!==3)throw Error("qkv_hidden_sizes attribute should have 3 elements");for(let S of Q.qkvHiddenSizes)if(S%Q.numHeads!==0)throw Error("qkv_hidden_sizes should be divisible by num_heads");B=Q.qkvHiddenSizes[0],U=Q.qkvHiddenSizes[1],E=Q.qkvHiddenSizes[2]}let R=V;if(B!==U)throw Error("qkv_hidden_sizes first element should be same as the second");if(H.dims[0]!==B+U+E)throw Error('Input "bias" dimension 0 should have same length as sum of Q/K/V hidden sizes');let A=0;if(G){if(U!==E)throw Error('Input "past" expect k_hidden_size == v_hidden_size');if(G.dims.length!==5)throw Error('Input "past" must have 5 dimensions');if(G.dims[0]!==2)throw Error('Input "past" first dimension must be 2');if(G.dims[1]!==N)throw Error('Input "past" second dimension must be batch_size');if(G.dims[2]!==Q.numHeads)throw Error('Input "past" third dimension must be num_heads');if(G.dims[4]!==U/Q.numHeads)throw Error('Input "past" fifth dimension must be k_hidden_size / num_heads');Q.pastPresentShareBuffer||(A=G.dims[3])}let P=R+A,z=-1,D=0;if(W)throw Error("Mask not supported");if(G)throw Error("past is not supported");if(j){if(j.dims.length!==4)throw Error('Input "attention_bias" must have 4 dimensions');if(j.dims[0]!==N||j.dims[1]!==Q.numHeads||j.dims[2]!==V||j.dims[3]!==P)throw Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)')}return{batchSize:N,sequenceLength:V,pastSequenceLength:A,kvSequenceLength:R,totalSequenceLength:P,maxSequenceLength:z,inputHiddenSize:L,hiddenSize:B,vHiddenSize:E,headSize:Math.floor(B/Q.numHeads),vHeadSize:Math.floor(E/Q.numHeads),numHeads:Q.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:Q.maskFilterValue,maskType:D,scale:Q.scale,broadcastResPosBias:!1,passPastInKv:!1,qkvFormat:1}},n5=(J,Q,X)=>Q&&J?`
      let total_sequence_length_input = u32(${Q.getByOffset("0")});
      let present_sequence_length = max(total_sequence_length_input, uniforms.past_sequence_length);
      let is_subsequent_prompt: bool = sequence_length > 1 && sequence_length != total_sequence_length_input;
      let is_first_prompt: bool = is_subsequent_prompt == false && sequence_length == total_sequence_length_input;
      total_sequence_length = u32(${J?.getByOffset("batchIdx")}) + 1;
      var past_sequence_length: u32 = 0;
      if (is_first_prompt == false) {
        past_sequence_length = total_sequence_length - sequence_length;
      }
       `:`
    ${X?"let past_sequence_length = uniforms.past_sequence_length":""};
    let present_sequence_length = total_sequence_length;
    `,pK=(J,Q,X,Y,H,W,G,j)=>{let N=e0(G?1:W),V=64,L=W/N;L<V&&(V=32);let B=Math.ceil(W/N/V),U=[{type:12,data:Q},{type:12,data:X},{type:12,data:Y},{type:12,data:H},{type:12,data:L},{type:12,data:B}],E=K1(J.dataType,N),R=P1(1,N),A=["type"];G&&A.push("type"),j&&A.push("type");let P=(z)=>{let D=B0("x",J.dataType,J.dims,N),S=[D],w=G?i("seq_lens",G.dataType,G.dims):void 0;w&&S.push(w);let k=j?i("total_sequence_length_input",j.dataType,j.dims):void 0;k&&S.push(k);let I=P1(J.dataType),C=[{name:"batch_size",type:"u32"},{name:"num_heads",type:"u32"},{name:"past_sequence_length",type:"u32"},{name:"sequence_length",type:"u32"},{name:"total_sequence_length",type:"u32"},{name:"elements_per_thread",type:"u32"}];return`
  var<workgroup> thread_max: array<f32, ${V}>;
  var<workgroup> thread_sum: array<f32, ${V}>;
  ${z.registerUniforms(C).declareVariables(...S)}
  ${z.mainStart([V,1,1])}
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let sequence_length = uniforms.sequence_length;
    var total_sequence_length = uniforms.total_sequence_length;
    ${n5(w,k,!1)}
    let local_offset = local_idx * uniforms.elements_per_thread;
    let offset = (global_idx / ${V}) * uniforms.total_sequence_length + local_offset;
    let seq_causal_length = ${G?"u32(past_sequence_length + workgroup_id.y + 1)":"total_sequence_length"};
    var thread_max_vector = ${R}(-3.402823e+38f);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      thread_max_vector = max(${R}(x[offset + i]), thread_max_vector);
    }
    thread_max[local_idx] = ${(()=>{switch(N){case 1:return"thread_max_vector";case 2:return"max(thread_max_vector.x, thread_max_vector.y)";case 4:return"max(max(thread_max_vector.x, thread_max_vector.y), max(thread_max_vector.z, thread_max_vector.w))";default:throw Error(`Unsupported components: ${N}`)}})()};
    workgroupBarrier();

    var max_value =  f32(-3.402823e+38f);
    for (var i = 0u; i < ${V}; i++) {
      max_value = max(thread_max[i], max_value);
    }

    var sum_vector = ${R}(0);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      sum_vector += exp(${R}(x[offset + i]) - max_value);
    }
    thread_sum[local_idx] = ${(()=>{switch(N){case 1:return"sum_vector";case 2:return"sum_vector.x + sum_vector.y";case 4:return"sum_vector.x + sum_vector.y + sum_vector.z + sum_vector.w";default:throw Error(`Unsupported components: ${N}`)}})()};
    workgroupBarrier();

    var sum: f32 = 0;
    for (var i = 0u; i < ${V}; i++) {
      sum += thread_sum[i];
    }

    if (sum == 0) {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        x[offset + i] = ${D.type.value}(${I}(1.0) / ${I}(seq_causal_length));
      }
    } else {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        var f32input = ${R}(x[offset + i]);
        x[offset + i] = ${D.type.value}(exp(f32input - max_value) / sum);
      }
    }
      ${G?`
        for (var total_seq_id: u32 = seq_causal_length; total_seq_id + local_offset < uniforms.total_sequence_length; total_seq_id++) {
          x[offset + total_seq_id] = ${D.type.value}(${I}(0));
        }`:""};
  }`};return{name:"AttentionProbsSoftmax",shaderCache:{hint:`${V};${E};${N}`,inputDependencies:A},getShaderSource:P,getRunData:()=>({outputs:[],dispatchGroup:{x:Math.ceil(W/V),y:H,z:Q*X},programUniforms:U})}},cK=(J,Q,X,Y,H,W,G,j,N)=>{let V=G+W.kvSequenceLength,L=[W.batchSize,W.numHeads,W.sequenceLength,V],B=J>1&&Y,U=W.kvNumHeads?W.kvNumHeads:W.numHeads,E=B?[W.batchSize,U,V,W.headSize]:void 0,R=W.nReps?W.nReps:1,A=W.scale===0?1/Math.sqrt(W.headSize):W.scale,P=e0(W.headSize),z=W.headSize/P,D=12,S={x:Math.ceil(V/D),y:Math.ceil(W.sequenceLength/D),z:W.batchSize*W.numHeads},w=[{type:12,data:W.sequenceLength},{type:12,data:z},{type:12,data:V},{type:12,data:W.numHeads},{type:12,data:W.headSize},{type:1,data:A},{type:12,data:G},{type:12,data:W.kvSequenceLength},{type:12,data:R}],k=B&&Y&&u.size(Y.dims)>0,I=["type","type"];k&&I.push("type"),H&&I.push("type"),j&&I.push("type"),N&&I.push("type");let C=[{dims:L,dataType:Q.dataType,gpuDataType:0}];B&&C.push({dims:E,dataType:Q.dataType,gpuDataType:0});let T=(g)=>{let m=i("q",Q.dataType,Q.dims,P),l=i("key",X.dataType,X.dims,P),t=[m,l];if(k){let s=i("past_key",Y.dataType,Y.dims,P);t.push(s)}H&&t.push(i("attention_bias",H.dataType,H.dims));let h=j?i("seq_lens",j.dataType,j.dims):void 0;h&&t.push(h);let W0=N?i("total_sequence_length_input",N.dataType,N.dims):void 0;W0&&t.push(W0);let j0=B0("output",Q.dataType,L),o=[j0];B&&o.push(B0("present_key",Q.dataType,E,P));let G0=P1(1,P),F0=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"alpha",type:"f32"},{name:"past_sequence_length",type:"u32"},{name:"kv_sequence_length",type:"u32"},{name:"n_reps",type:"u32"}];return`
  const TILE_SIZE = ${D}u;

  var<workgroup> tileQ: array<${m.type.storage}, ${D*D}>;
  var<workgroup> tileK: array<${m.type.storage}, ${D*D}>;
  ${g.registerUniforms(F0).declareVariables(...t,...o)}
  ${g.mainStart([D,D,1])}
    // x holds the N and y holds the M
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let kvHeadIdx = ${R===1?"headIdx":"headIdx / uniforms.n_reps"};
    let kv_num_heads = ${R===1?"uniforms.num_heads":"uniforms.num_heads / uniforms.n_reps"};
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let m = workgroup_id.y * TILE_SIZE;
    let n = workgroup_id.x * TILE_SIZE;
    let sequence_length = uniforms.M;
    var total_sequence_length = uniforms.N;
    ${n5(h,W0,!0)}
    let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx;
    let qOffset = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
    ${k&&B?"let pastKeyOffset = absKvHeadIdx * uniforms.past_sequence_length * uniforms.K;":""};
    let kOffset = absKvHeadIdx * uniforms.kv_sequence_length * uniforms.K;
    ${B?"let presentKeyOffset = absKvHeadIdx * uniforms.N * uniforms.K;":""}
    var value = ${G0}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (global_id.y < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = q[qOffset + local_id.y * uniforms.K + w + local_id.x];
      }
      if (n + local_id.y < uniforms.N && w + local_id.x < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
      ${k&&B?`
              if (n + local_id.y < past_sequence_length) {
                tileK[idx] = past_key[pastKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
              } else if (n + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
                tileK[idx] = key[kOffset + (n + local_id.y - past_sequence_length) * uniforms.K + w + local_id.x];
              }`:`
          if (n + local_id.y < uniforms.kv_sequence_length) {
            tileK[idx] = key[kOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
          }`}
      ${B?`if (n + local_id.y < present_sequence_length) {
        present_key[presentKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x] = tileK[idx];
      }`:""}
      }
      workgroupBarrier();

      for (var k: u32 = 0u; k < TILE_SIZE && w+k < uniforms.K; k++) {
          value += ${G0}(tileQ[TILE_SIZE * local_id.y + k] * tileK[TILE_SIZE * local_id.x + k]);
      }

      workgroupBarrier();
    }

    if (global_id.y < uniforms.M && global_id.x < total_sequence_length) {
      let headOffset = workgroup_id.z * uniforms.M * uniforms.N;
      let outputIdx = headOffset + global_id.y * uniforms.N + global_id.x;
      var sum: f32 = ${(()=>{switch(P){case 1:return"value";case 2:return"value.x + value.y";case 4:return"value.x + value.y + value.z + value.w";default:throw Error(`Unsupported components: ${P}`)}})()};
        output[outputIdx] = ${j0.type.value} (sum * uniforms.alpha) + ${H?"attention_bias[outputIdx]":"0.0"};
    }
  }`};return{name:"AttentionProbs",shaderCache:{hint:`${P};${H!==void 0};${Y!==void 0};${J}`,inputDependencies:I},getRunData:()=>({outputs:C,dispatchGroup:S,programUniforms:w}),getShaderSource:T}},dK=(J,Q,X,Y,H,W,G=void 0,j=void 0)=>{let N=W+H.kvSequenceLength,V=H.nReps?H.nReps:1,L=H.vHiddenSize*V,B=J>1&&Y,U=H.kvNumHeads?H.kvNumHeads:H.numHeads,E=B?[H.batchSize,U,N,H.headSize]:void 0,R=[H.batchSize,H.sequenceLength,L],A=12,P={x:Math.ceil(H.vHeadSize/A),y:Math.ceil(H.sequenceLength/A),z:H.batchSize*H.numHeads},z=[{type:12,data:H.sequenceLength},{type:12,data:N},{type:12,data:H.vHeadSize},{type:12,data:H.numHeads},{type:12,data:H.headSize},{type:12,data:L},{type:12,data:W},{type:12,data:H.kvSequenceLength},{type:12,data:V}],D=B&&Y&&u.size(Y.dims)>0,S=["type","type"];D&&S.push("type"),G&&S.push("type"),j&&S.push("type");let w=[{dims:R,dataType:Q.dataType,gpuDataType:0}];B&&w.push({dims:E,dataType:Q.dataType,gpuDataType:0});let k=(I)=>{let C=i("probs",Q.dataType,Q.dims),T=i("v",X.dataType,X.dims),g=[C,T];D&&g.push(i("past_value",Y.dataType,Y.dims));let m=G?i("seq_lens",G.dataType,G.dims):void 0;G&&g.push(m);let l=j?i("total_sequence_length_input",j.dataType,j.dims):void 0;j&&g.push(l);let t=[B0("output",Q.dataType,R)];B&&t.push(B0("present_value",Q.dataType,E));let h=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"v_hidden_size",type:"u32"},{name:"past_sequence_length",type:"u32"},{name:"kv_sequence_length",type:"u32"},{name:"n_reps",type:"u32"}];return`
  const TILE_SIZE = ${A}u;
  var<workgroup> tileQ: array<${C.type.value}, ${A*A}>;
  var<workgroup> tileV: array<${C.type.value}, ${A*A}>;
  ${I.registerUniforms(h).declareVariables(...g,...t)}
  ${I.mainStart([A,A,1])}
   let headIdx = workgroup_id.z % uniforms.num_heads;
   let batchIdx = workgroup_id.z / uniforms.num_heads;
   let kvHeadIdx = ${V===1?"headIdx":"headIdx / uniforms.n_reps"};
   let kv_num_heads = ${V===1?"uniforms.num_heads":"uniforms.num_heads / uniforms.n_reps"};
   let m = global_id.y;
   let n = global_id.x;
   let sequence_length = uniforms.M;
   var total_sequence_length = uniforms.K;
   ${n5(m,l,!0)}
   let offsetA = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
   let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx; // kvHeadIdx is relative to the batch
   ${D&&B?"let pastValueOffset = absKvHeadIdx * uniforms.N * uniforms.past_sequence_length + n;":""};
   let vOffset = absKvHeadIdx * uniforms.N * uniforms.kv_sequence_length + n;
   ${B?"let presentValueOffset = absKvHeadIdx * uniforms.N * uniforms.K + n;":""}
   var value = ${C.type.storage}(0);
   for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = probs[offsetA + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
        ${D&&B?`
        if (w + local_id.y < past_sequence_length) {
          tileV[idx] = past_value[pastValueOffset + (w + local_id.y) * uniforms.N];
        } else if (w + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
          tileV[idx] = v[vOffset + (w + local_id.y - past_sequence_length) * uniforms.N];
        }
      `:`
            if (w + local_id.y < uniforms.kv_sequence_length) {
              tileV[idx] = v[vOffset + (w + local_id.y) * uniforms.N];
            }`}
        ${B?`
            if (w + local_id.y < present_sequence_length) {
          present_value[presentValueOffset + (w + local_id.y) * uniforms.N] = tileV[idx];
        }`:""}
      }
     workgroupBarrier();
     for (var k: u32 = 0u; k < TILE_SIZE && w+k < total_sequence_length; k++) {
       value += tileQ[TILE_SIZE * local_id.y + k] * tileV[TILE_SIZE * k + local_id.x];
     }
     workgroupBarrier();
   }

   // we need to transpose output from BNSH_v to BSND_v
   if (m < uniforms.M && n < uniforms.N) {
     let outputIdx = batchIdx * uniforms.M * uniforms.v_hidden_size + m * uniforms.v_hidden_size
       + headIdx * uniforms.N + n;
     output[outputIdx] = value;
   }
  }`};return{name:"AttentionScore",shaderCache:{hint:`${Y!==void 0};${J}`,inputDependencies:S},getRunData:()=>({outputs:w,dispatchGroup:P,programUniforms:z}),getShaderSource:k}},t2=(J,Q,X,Y,H,W,G,j,N,V,L=void 0,B=void 0)=>{let U=Math.min(J.outputCount,1+(G?1:0)+(j?1:0)),E=U>1?V.pastSequenceLength:0,R=E+V.kvSequenceLength,A=N&&u.size(N.dims)>0?N:void 0,P=[Q,X];U>1&&G&&u.size(G.dims)>0&&P.push(G),A&&P.push(A),L&&P.push(L),B&&P.push(B);let z=J.compute(cK(U,Q,X,G,A,V,E,L,B),{inputs:P,outputs:U>1?[-1,1]:[-1]})[0];J.compute(pK(z,V.batchSize,V.numHeads,E,V.sequenceLength,R,L,B),{inputs:L&&B?[z,L,B]:[z],outputs:[]});let D=[z,Y];U>1&&j&&u.size(j.dims)>0&&D.push(j),L&&D.push(L),B&&D.push(B),J.compute(dK(U,z,Y,j,V,E,L,B),{inputs:D,outputs:U>1?[0,2]:[0]})},uK=(J,Q)=>{let X=[Q.batchSize,Q.numHeads,Q.sequenceLength,Q.headSize],Y=Q.sequenceLength,H=Q.inputHiddenSize,W=Q.headSize,G=12,j={x:Math.ceil(Q.headSize/G),y:Math.ceil(Q.sequenceLength/G),z:Q.batchSize*Q.numHeads},N=[J.inputs[0],J.inputs[1],J.inputs[2]],V=[{type:12,data:Y},{type:12,data:H},{type:12,data:W},{type:12,data:Q.numHeads},{type:12,data:Q.headSize},{type:12,data:Q.hiddenSize},{type:12,data:Q.hiddenSize+Q.hiddenSize+Q.vHiddenSize}],L=(B)=>{let U=B0("output_q",N[0].dataType,X),E=B0("output_k",N[0].dataType,X),R=B0("output_v",N[0].dataType,X),A=i("input",N[0].dataType,N[0].dims),P=i("weight",N[1].dataType,N[1].dims),z=i("bias",N[2].dataType,N[2].dims),D=A.type.storage,S=[{name:"M",type:"u32"},{name:"K",type:"u32"},{name:"N",type:"u32"},{name:"num_heads",type:"u32"},{name:"head_size",type:"u32"},{name:"hidden_size",type:"u32"},{name:"ldb",type:"u32"}];return`
  const TILE_SIZE = ${G}u;
  var<workgroup> tileInput: array<${D}, ${G*G}>;
  var<workgroup> tileWeightQ: array<${D}, ${G*G}>;
  var<workgroup> tileWeightK: array<${D}, ${G*G}>;
  var<workgroup> tileWeightV: array<${D}, ${G*G}>;
  ${B.registerUniforms(S).declareVariables(A,P,z,U,E,R)}
  ${B.mainStart([G,G,1])}
    let batchIndex = workgroup_id.z / uniforms.num_heads;
    let headNumber = workgroup_id.z % uniforms.num_heads;
    let m = global_id.y;
    let n = global_id.x;

    let inputOffset = batchIndex * (uniforms.M * uniforms.K) + m * uniforms.K;
    let biasOffsetQ = headNumber * uniforms.head_size;
    let biasOffsetK = uniforms.hidden_size + biasOffsetQ;
    let biasOffsetV = uniforms.hidden_size + biasOffsetK;

    var valueQ = ${D}(0);
    var valueK = ${D}(0);
    var valueV = ${D}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileInput[TILE_SIZE * local_id.y + local_id.x] = input[inputOffset + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        let offset = n + (w + local_id.y) * uniforms.ldb;
        tileWeightQ[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetQ + offset];
        tileWeightK[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetK + offset];
        tileWeightV[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetV + offset];
      }
      workgroupBarrier();
      for (var k: u32 = 0u; k<TILE_SIZE && w+k < uniforms.K; k++) {
        let inputTileOffset = TILE_SIZE * local_id.y + k;
        let weightTileOffset = TILE_SIZE * k + local_id.x;
        valueQ += tileInput[inputTileOffset] * tileWeightQ[weightTileOffset];
        valueK += tileInput[inputTileOffset] * tileWeightK[weightTileOffset];
        valueV += tileInput[inputTileOffset] * tileWeightV[weightTileOffset];
      }

      workgroupBarrier();
    }

    let headOffset = (m * uniforms.N + n) % uniforms.head_size;
    valueQ += bias[headOffset + biasOffsetQ];
    valueK += bias[headOffset + biasOffsetK];
    valueV += bias[headOffset + biasOffsetV];

    let offset = workgroup_id.z * uniforms.M * uniforms.N;
    if (m < uniforms.M && n < uniforms.N) {
      let outputIdx = offset + m * uniforms.N + n;
      output_q[outputIdx] = valueQ;
      output_k[outputIdx] = valueK;
      output_v[outputIdx] = valueV;
    }
  }`};return J.compute({name:"AttentionPrepare",shaderCache:{inputDependencies:["type","type","type"]},getRunData:()=>({outputs:[{dims:X,dataType:J.inputs[0].dataType,gpuDataType:0},{dims:X,dataType:J.inputs[0].dataType,gpuDataType:0},{dims:X,dataType:J.inputs[0].dataType,gpuDataType:0}],dispatchGroup:j,programUniforms:V}),getShaderSource:L},{inputs:N,outputs:[-1,-1,-1]})},CU=(J,Q)=>{let X=mK(J.inputs,Q),[Y,H,W]=uK(J,X);return t2(J,Y,H,W,J.inputs[4],void 0,void 0,void 0,J.inputs[5],X)}}),bA=Q0(()=>{M6(),z0(),w0(),Q1(),I0(),oK=(J,Q)=>{if(!J||J.length!==5)throw Error("BatchNormalization requires 5 inputs");let X=(Y,H,W)=>{let G=H.length;if(G!==Y.length)throw Error(`${W}: num dimensions != ${G}`);H.forEach((j,N)=>{if(j!==Y[N])throw Error(`${W}: dim[${N}] do not match`)})};if(J[0].dims.length>1){let Y=Q.format==="NHWC"?Q.spatial?J[0].dims.slice(-1):J[0].dims.slice(-1).concat(J[0].dims.slice(1,J[0].dims.length-1)):J[0].dims.slice(1,Q.spatial?2:void 0);X(J[1].dims,Y,"Invalid input scale"),X(J[2].dims,Y,"Invalid input B"),X(J[3].dims,Y,"Invalid input mean"),X(J[4].dims,Y,"Invalid input var")}else X(J[1].dims,[1],"Invalid input scale"),X(J[2].dims,[1],"Invalid input B"),X(J[3].dims,[1],"Invalid input mean"),X(J[4].dims,[1],"Invalid input var")},sK=(J,Q)=>{let{epsilon:X,spatial:Y,format:H}=Q,W=J[0].dims,G=Y?e0(W[W.length-1]):1,j=H==="NHWC"&&W.length>1?G:1,N=u.size(W)/G,V=Y,L=V?W.length:W,B=i("x",J[0].dataType,J[0].dims,G),U=i("scale",J[1].dataType,J[1].dims,j),E=i("bias",J[2].dataType,J[2].dims,j),R=i("inputMean",J[3].dataType,J[3].dims,j),A=i("inputVar",J[4].dataType,J[4].dims,j),P=B0("y",J[0].dataType,L,G),z=()=>{let S="";if(Y)S=`let cOffset = ${W.length===1?"0u":H==="NHWC"?`outputIndices[${W.length-1}] / ${G}`:"outputIndices[1]"};`;else if(H==="NCHW")S=`
            ${P.indicesSet("outputIndices","0","0")}
            let cOffset = ${P.indicesToOffset("outputIndices")};`;else{S=`var cIndices = ${U.type.indices}(0);
                       cIndices[0] = outputIndices[${W.length-1}];`;for(let w=1;w<U.rank;w++)S+=`cIndices[${w}] = outputIndices[${w}];`;S+=`let cOffset = ${U.indicesToOffset("cIndices")};`}return S},D=(S)=>`
  const epsilon = ${X};
  ${S.registerUniform("outputSize","u32").declareVariables(B,U,E,R,A,P)}
  ${S.mainStart()}
  ${S.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
    var outputIndices = ${P.offsetToIndices(`global_idx * ${G}`)};
    ${z()}
    let scale = ${U.getByOffset("cOffset")};
    let bias = ${E.getByOffset("cOffset")};
    let inputMean = ${R.getByOffset("cOffset")};
    let inputVar = ${A.getByOffset("cOffset")};
    let x = ${B.getByOffset("global_idx")};
    let value = (x - inputMean) * inverseSqrt(inputVar + epsilon) * scale + bias;
    ${P.setByOffset("global_idx","value")}
  }`;return{name:"BatchNormalization",shaderCache:{hint:`${Q.epsilon}_${Q.format}_${Y}_${G}`,inputDependencies:V?["rank","type","type","type","type"]:void 0},getShaderSource:D,getRunData:()=>({outputs:[{dims:J[0].dims,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(N/64)},programUniforms:V?[{type:12,data:N},...R0(W)]:[{type:12,data:N}]})}},aK=(J)=>d0(J),IU=(J,Q)=>{let{inputs:X,outputCount:Y}=J,H=aK({...Q,outputCount:Y});if(i0.webgpu.validateInputContent&&oK(X,H),Q.trainingMode)throw Error("BatchNormalization trainingMode is not supported yet.");J.compute(sK(X,H))}}),vA=Q0(()=>{w0(),I0(),iK=(J)=>{if(J[0].dims.length!==3)throw Error("input should have 3 dimensions");if(![320,640,1280].includes(J[0].dims[2]))throw Error("number of channels should be 320, 640 or 1280");if(J[1].dims.length!==1)throw Error("bias is expected to have 1 dimensions");if(J[0].dims[2]!==J[1].dims[0])throw Error("last dimension of input and bias are not the same")},nK=(J)=>{let Q=J[0].dims,X=J[0].dims[2],Y=u.size(Q)/4,H=J[0].dataType,W=i("input",H,Q,4),G=i("bias",H,[X],4),j=i("residual",H,Q,4),N=B0("output",H,Q,4);return{name:"BiasAdd",getRunData:()=>({outputs:[{dims:Q,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(Y/64)}}),getShaderSource:(V)=>`
  const channels = ${X}u / 4;
  ${V.declareVariables(W,G,j,N)}

  ${V.mainStart()}
    ${V.guardAgainstOutOfBoundsWorkgroupSizes(Y)}
    let value = ${W.getByOffset("global_idx")}
      + ${G.getByOffset("global_idx % channels")} + ${j.getByOffset("global_idx")};
    ${N.setByOffset("global_idx","value")}
  }`}},_U=(J)=>{iK(J.inputs),J.compute(nK(J.inputs))}}),HH=Q0(()=>{z0(),w0(),Q1(),I0(),rK=(J,Q,X,Y,H,W,G)=>{let j=Math.ceil(Q/4),N="";typeof H=="string"?N=`${H}(a)`:N=H("a");let V=i("inputData",X,[j],4),L=B0("outputData",Y,[j],4),B=[{name:"vec_size",type:"u32"}];return G&&B.push(...G),`
      ${J.registerUniforms(B).declareVariables(V,L)}

  ${W??""}

  ${J.mainStart()}
    ${J.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}

    let a = ${V.getByOffset("global_idx")};
    ${L.setByOffset("global_idx",N)}
  }`},g0=(J,Q,X,Y,H,W=J.dataType,G,j)=>{let N=[{type:12,data:Math.ceil(u.size(J.dims)/4)}];return G&&N.push(...G),{name:Q,shaderCache:{hint:H,inputDependencies:["type"]},getShaderSource:(V)=>rK(V,u.size(J.dims),J.dataType,W,X,Y,j),getRunData:(V)=>({outputs:[{dims:J.dims,dataType:W}],dispatchGroup:{x:Math.ceil(u.size(V[0].dims)/64/4)},programUniforms:N})}},bU=(J)=>{J.compute(g0(J.inputs[0],"Abs","abs"))},vU=(J)=>{J.compute(g0(J.inputs[0],"Acos","acos"))},TU=(J)=>{J.compute(g0(J.inputs[0],"Acosh","acosh"))},xU=(J)=>{J.compute(g0(J.inputs[0],"Asin","asin"))},fU=(J)=>{J.compute(g0(J.inputs[0],"Asinh","asinh"))},hU=(J)=>{J.compute(g0(J.inputs[0],"Atan","atan"))},yU=(J)=>{J.compute(g0(J.inputs[0],"Atanh","atanh"))},gU=(J)=>d0(J),lU=(J,Q)=>{let X;switch(Q.to){case 10:X="vec4<f16>";break;case 1:X="vec4<f32>";break;case 12:X="vec4<u32>";break;case 6:X="vec4<i32>";break;case 9:X="vec4<bool>";break;default:throw RangeError(`not supported type (specified in attribute 'to' from 'Cast' operator): ${Q.to}`)}J.compute(g0(J.inputs[0],"Cast",X,void 0,Q.cacheKey,Q.to))},tK=(J)=>{let Q,X,Y=J.length>=2&&J[1].data!==0,H=J.length>=3&&J[2].data!==0;switch(J[0].dataType){case 1:Q=Y?J[1].getFloat32Array()[0]:-340282346638528860000000000000000000000,X=H?J[2].getFloat32Array()[0]:340282346638528860000000000000000000000;break;case 10:Q=Y?J[1].getUint16Array()[0]:64511,X=H?J[2].getUint16Array()[0]:31743;break;default:throw Error("Unsupport data type")}return d0({min:Q,max:X})},mU=(J,Q)=>{let X=Q||tK(J.inputs),Y=P1(J.inputs[0].dataType);J.compute(g0(J.inputs[0],"Clip",(H)=>`clamp(${H}, vec4<${Y}>(uniforms.min), vec4<${Y}>(uniforms.max))`,void 0,X.cacheKey,void 0,[{type:J.inputs[0].dataType,data:X.min},{type:J.inputs[0].dataType,data:X.max}],[{name:"min",type:Y},{name:"max",type:Y}]),{inputs:[0]})},pU=(J)=>{J.compute(g0(J.inputs[0],"Ceil","ceil"))},cU=(J)=>{J.compute(g0(J.inputs[0],"Cos","cos"))},dU=(J)=>{J.compute(g0(J.inputs[0],"Cosh","cosh"))},a2=(J)=>d0(J),uU=(J,Q)=>{let X=P1(J.inputs[0].dataType);J.compute(g0(J.inputs[0],"Elu",(Y)=>`elu_vf32(${Y})`,`
  const elu_alpha_ = ${X}(${Q.alpha});

  fn elu_f32(a: ${X}) -> ${X} {
  return select((exp(a) - 1.0) * elu_alpha_, a, a >= 0.0);
  }

  fn elu_vf32(v: vec4<${X}>) -> vec4<${X}> {
  return vec4(elu_f32(v.x), elu_f32(v.y), elu_f32(v.z), elu_f32(v.w));
  }`,Q.cacheKey))},H4=(J="f32")=>`
const r0: ${J} = 0.3275911;
const r1: ${J} = 0.254829592;
const r2: ${J} = -0.284496736;
const r3: ${J} = 1.421413741;
const r4: ${J} = -1.453152027;
const r5: ${J} = 1.061405429;

fn erf_vf32(v: vec4<${J}>) -> vec4<${J}> {
  let absv = abs(v);
  let x = 1.0 / (1.0 + r0 * absv);
  return sign(v) * (1.0 - ((((r5 * x + r4) * x + r3) * x + r2) * x + r1) * x * exp(-absv * absv));
}`,oU=(J)=>{let Q=P1(J.inputs[0].dataType);J.compute(g0(J.inputs[0],"Erf",(X)=>`erf_vf32(${X})`,H4(Q)))},sU=(J)=>{J.compute(g0(J.inputs[0],"Exp","exp"))},aU=(J)=>{J.compute(g0(J.inputs[0],"Floor","floor"))},iU=(J)=>{let Q=P1(J.inputs[0].dataType);J.compute(g0(J.inputs[0],"Gelu",(X)=>`0.5 * ${X} * (1.0 + erf_vf32(${X} * 0.7071067811865475))`,H4(Q)))},nU=(J,Q)=>{let X=P1(J.inputs[0].dataType);J.compute(g0(J.inputs[0],"LeakyRelu",(Y)=>`select(leaky_relu_alpha_ * ${Y}, ${Y}, ${Y} >= vec4<${X}>(0.0))`,`const leaky_relu_alpha_ = ${X}(${Q.alpha});`,Q.cacheKey))},rU=(J)=>{J.compute(g0(J.inputs[0],"Not",(Q)=>`!${Q}`))},tU=(J)=>{J.compute(g0(J.inputs[0],"Neg",(Q)=>`-${Q}`))},eU=(J)=>{J.compute(g0(J.inputs[0],"Reciprocal",(Q)=>`1.0/${Q}`))},JO=(J)=>{let Q=P1(J.inputs[0].dataType);J.compute(g0(J.inputs[0],"Relu",(X)=>`select(vec4<${Q}>(0.0), ${X}, ${X} > vec4<${Q}>(0.0))`))},QO=(J)=>{J.compute(g0(J.inputs[0],"Sigmoid",(Q)=>`(1.0 / (1.0 + exp(-${Q})))`))},XO=(J)=>d0(J),YO=(J,Q)=>{let X=P1(J.inputs[0].dataType);J.compute(g0(J.inputs[0],"HardSigmoid",(Y)=>`max(vec4<${X}>(0.0), min(vec4<${X}>(1.0), ${Q.alpha} * ${Y} + vec4<${X}>(${Q.beta})))`,void 0,Q.cacheKey))},HO=(J)=>{J.compute(g0(J.inputs[0],"Sin","sin"))},qO=(J)=>{J.compute(g0(J.inputs[0],"Sinh","sinh"))},WO=(J)=>{J.compute(g0(J.inputs[0],"Sqrt","sqrt"))},GO=(J)=>{J.compute(g0(J.inputs[0],"Tan","tan"))},i3=(J)=>`sign(${J}) * (1 - exp(-2 * abs(${J}))) / (1 + exp(-2 * abs(${J})))`,jO=(J)=>{J.compute(g0(J.inputs[0],"Tanh",i3))},bY=(J="f32")=>`
const fast_gelu_a: ${J} = 0.5;
const fast_gelu_b: ${J} = 0.7978845608028654;
const fast_gelu_c: ${J} = 0.035677408136300125;

fn tanh_v(v: vec4<${J}>) -> vec4<${J}> {
  return ${i3("v")};
}
`,vY=(J)=>`(fast_gelu_a + fast_gelu_a * tanh_v(${J} * (fast_gelu_c * ${J} * ${J} + fast_gelu_b))) * ${J}`,FO=(J)=>{let Q=P1(J.inputs[0].dataType);J.compute(g0(J.inputs[0],"FastGelu",vY,bY(Q),void 0,J.inputs[0].dataType))},NO=(J,Q)=>{let X=P1(J.inputs[0].dataType);return J.compute(g0(J.inputs[0],"ThresholdedRelu",(Y)=>`select(vec4<${X}>(0.0), ${Y}, ${Y} > thresholded_relu_alpha_)`,`const thresholded_relu_alpha_ = vec4<${X}>(${Q.alpha});`,Q.cacheKey)),0},VO=(J)=>{J.compute(g0(J.inputs[0],"Log","log"))},eK=(J,Q)=>`
const alpha = vec4<${J}>(${Q});
const one = ${J}(1.0);
const zero = ${J}(0.0);

fn quick_gelu_impl(x: vec4<${J}>) -> vec4<${J}> {
  let v = x *alpha;
  var x1 : vec4<${J}>;
  for (var i = 0; i < 4; i = i + 1) {
    if (v[i] >= zero) {
      x1[i] = one / (one + exp(-v[i]));
    } else {
      x1[i] = one - one / (one + exp(v[i]));
    }
  }
  return x * x1;
}
`,JM=(J)=>`quick_gelu_impl(${J})`,KO=(J,Q)=>{let X=P1(J.inputs[0].dataType);J.compute(g0(J.inputs[0],"QuickGelu",JM,eK(X,Q.alpha),Q.cacheKey,J.inputs[0].dataType))}}),TA=Q0(()=>{w0(),I0(),HH(),QM=(J)=>{if(J[0].dims.length!==3)throw Error("input should have 3 dimensions");if(![2560,5120,10240].includes(J[0].dims[2]))throw Error("hidden state should be 2560, 5120 or 10240");if(J[1].dims.length!==1)throw Error("bias is expected to have 1 dimensions");if(J[0].dims[2]!==J[1].dims[0])throw Error("last dimension of input and bias are not the same")},XM=(J)=>{let Q=J[0].dims.slice();Q[2]=Q[2]/2;let X=i("input",J[0].dataType,J[0].dims,4),Y=i("bias",J[0].dataType,[J[0].dims[2]],4),H=B0("output",J[0].dataType,Q,4),W=u.size(Q)/4,G=K1(J[0].dataType);return{name:"BiasSplitGelu",getRunData:()=>({outputs:[{dims:Q,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(W/64)}}),getShaderSource:(j)=>`
  const M_SQRT2 = sqrt(2.0);
  const halfChannels = ${J[0].dims[2]/4/2}u;

  ${j.declareVariables(X,Y,H)}

  ${H4(G)}

  ${j.mainStart()}
    ${j.guardAgainstOutOfBoundsWorkgroupSizes(W)}
    let biasIdx = global_idx % halfChannels;
    let batchIndex = global_idx / halfChannels;
    let inputOffset = biasIdx + batchIndex * halfChannels * 2;
    let valueLeft = input[inputOffset] + bias[biasIdx];
    let valueRight = input[inputOffset + halfChannels] + bias[biasIdx + halfChannels];
    let geluRight = valueRight * 0.5 * (erf_vf32(valueRight / M_SQRT2) + 1);

    ${H.setByOffset("global_idx","valueLeft * geluRight")}
  }`}},MO=(J)=>{QM(J.inputs),J.compute(XM(J.inputs))}}),xA=Q0(()=>{z0(),w0(),I0(),YM=(J,Q,X,Y,H,W,G,j,N,V,L,B)=>{let U,E;typeof j=="string"?U=E=(D,S)=>`${j}((${D}),(${S}))`:typeof j=="function"?U=E=j:(U=j.scalar,E=j.vector);let R=B0("outputData",L,Y.length,4),A=i("aData",N,Q.length,4),P=i("bData",V,X.length,4),z;if(H)if(W){let D=u.size(Q)===1,S=u.size(X)===1,w=Q.length>0&&Q[Q.length-1]%4===0,k=X.length>0&&X[X.length-1]%4===0;D||S?z=R.setByOffset("global_idx",E(D?`${A.type.value}(${A.getByOffset("0")}.x)`:A.getByOffset("global_idx"),S?`${P.type.value}(${P.getByOffset("0")}.x)`:P.getByOffset("global_idx"))):z=`
            let outputIndices = ${R.offsetToIndices("global_idx * 4u")};
            let offsetA = ${A.broadcastedIndicesToOffset("outputIndices",R)};
            let offsetB = ${P.broadcastedIndicesToOffset("outputIndices",R)};
            ${R.setByOffset("global_idx",E(G||w?A.getByOffset("offsetA / 4u"):`${A.type.value}(${A.getByOffset("offsetA / 4u")}[offsetA % 4u])`,G||k?P.getByOffset("offsetB / 4u"):`${P.type.value}(${P.getByOffset("offsetB / 4u")}[offsetB % 4u])`))}
          `}else z=R.setByOffset("global_idx",E(A.getByOffset("global_idx"),P.getByOffset("global_idx")));else{if(!W)throw Error("no necessary to use scalar implementation for element-wise binary op implementation.");let D=(S,w,k="")=>{let I=`aData[indexA${w}][componentA${w}]`,C=`bData[indexB${w}][componentB${w}]`;return`
            let outputIndices${w} = ${R.offsetToIndices(`global_idx * 4u + ${w}u`)};
            let offsetA${w} = ${A.broadcastedIndicesToOffset(`outputIndices${w}`,R)};
            let offsetB${w} = ${P.broadcastedIndicesToOffset(`outputIndices${w}`,R)};
            let indexA${w} = offsetA${w} / 4u;
            let indexB${w} = offsetB${w} / 4u;
            let componentA${w} = offsetA${w} % 4u;
            let componentB${w} = offsetB${w} % 4u;
            ${S}[${w}] = ${k}(${U(I,C)});
          `};L===9?z=`
            var data = vec4<u32>(0);
            ${D("data",0,"u32")}
            ${D("data",1,"u32")}
            ${D("data",2,"u32")}
            ${D("data",3,"u32")}
            outputData[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:z=`
            ${D("outputData[global_idx]",0)}
            ${D("outputData[global_idx]",1)}
            ${D("outputData[global_idx]",2)}
            ${D("outputData[global_idx]",3)}
          `}return`
        ${J.registerUniform("vec_size","u32").declareVariables(A,P,R)}

        ${B??""}

        ${J.mainStart()}
        ${J.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${z}
      }`},HM=(J,Q,X,Y,H,W,G=X.dataType)=>{let j=X.dims.map((A)=>Number(A)??1),N=Y.dims.map((A)=>Number(A)??1),V=!u.areEqual(j,N),L=j,B=u.size(j),U=!1,E=!1,R=[V];if(V){let A=q7.calcShape(j,N,!1);if(!A)throw Error("Can't perform binary op on the given tensors");L=A.slice(),B=u.size(L);let P=u.size(j)===1,z=u.size(N)===1,D=j.length>0&&j[j.length-1]%4===0,S=N.length>0&&N[N.length-1]%4===0;R.push(P),R.push(z),R.push(D),R.push(S);let w=1;for(let k=1;k<L.length;k++){let I=j[j.length-k],C=N[N.length-k];if(I===C)w*=I;else break}w%4===0?(E=!0,U=!0):(P||z||D||S)&&(U=!0)}else U=!0;return R.push(U),{name:J,shaderCache:{hint:Q+R.map((A)=>A.toString()).join("_"),inputDependencies:["rank","rank"]},getShaderSource:(A)=>YM(A,j,N,L,U,V,E,H,X.dataType,Y.dataType,G,W),getRunData:()=>({outputs:[{dims:L,dataType:G}],dispatchGroup:{x:Math.ceil(B/64/4)},programUniforms:[{type:12,data:Math.ceil(u.size(L)/4)},...R0(j,N,L)]})}},N6=(J,Q,X,Y,H,W)=>{J.compute(HM(Q,H??"",J.inputs[0],J.inputs[1],X,Y,W))},BO=(J)=>{N6(J,"Add",(Q,X)=>`${Q}+${X}`)},LO=(J)=>{N6(J,"Div",(Q,X)=>`${Q}/${X}`)},UO=(J)=>{N6(J,"Equal",{scalar:(Q,X)=>`u32(${Q}==${X})`,vector:(Q,X)=>`vec4<u32>(${Q}==${X})`},void 0,void 0,9)},OO=(J)=>{N6(J,"Mul",(Q,X)=>`${Q}*${X}`)},RO=(J)=>{let Q=i("input",J.inputs[0].dataType,J.inputs[0].dims).type.value;N6(J,"Pow",{scalar:(X,Y)=>`pow_custom(${X},${Y})`,vector:(X,Y)=>`pow_vector_custom(${X},${Y})`},`
    fn pow_custom(a : ${Q}, b : ${Q}) -> ${Q} {
      if (b == ${Q}(0.0)) {
        return ${Q}(1.0);
      } else if (a < ${Q}(0.0) && f32(b) != floor(f32(b))) {
        return ${Q}(pow(f32(a), f32(b))); // NaN
      }
      return select(sign(a), ${Q}(1.0), round(f32(abs(b) % ${Q}(2.0))) != 1.0) * ${Q}(${Q==="i32"?"round":""}(pow(f32(abs(a)), f32(b))));
    }
    fn pow_vector_custom(a : vec4<${Q}>, b : vec4<${Q}>) -> vec4<${Q}> {
      // TODO: implement vectorized pow
      return vec4<${Q}>(pow_custom(a.x, b.x), pow_custom(a.y, b.y), pow_custom(a.z, b.z), pow_custom(a.w, b.w));
    }
      `)},EO=(J)=>{N6(J,"Sub",(Q,X)=>`${Q}-${X}`)},DO=(J)=>{N6(J,"Greater",{scalar:(Q,X)=>`u32(${Q}>${X})`,vector:(Q,X)=>`vec4<u32>(${Q}>${X})`},void 0,void 0,9)},AO=(J)=>{N6(J,"Less",{scalar:(Q,X)=>`u32(${Q}<${X})`,vector:(Q,X)=>`vec4<u32>(${Q}<${X})`},void 0,void 0,9)},zO=(J)=>{N6(J,"GreaterOrEqual",{scalar:(Q,X)=>`u32(${Q}>=${X})`,vector:(Q,X)=>`vec4<u32>(${Q}>=${X})`},void 0,void 0,9)},$O=(J)=>{N6(J,"LessOrEqual",{scalar:(Q,X)=>`u32(${Q}<=${X})`,vector:(Q,X)=>`vec4<u32>(${Q}<=${X})`},void 0,void 0,9)}}),fA=Q0(()=>{z0(),w0(),Q1(),I0(),qM=(J,Q)=>{if(!J||J.length<1)throw Error("too few inputs");let X=0,Y=J[X],H=Y.dataType,W=Y.dims.length;J.forEach((G,j)=>{if(j!==X){if(G.dataType!==H)throw Error("input tensors should be one type");if(G.dims.length!==W)throw Error("input tensors should have the same shape");G.dims.forEach((N,V)=>{if(V!==Q&&N!==Y.dims[V])throw Error("non concat dimensions must match")})}})},WM=(J,Q)=>`
  fn calculateInputIndex(index: u32) -> u32 {
    let sizeInConcatAxis = array<u32, ${J}u>(${Q});
    for (var i: u32 = 0u; i < ${J}; i += 1u ) {
      if (index < sizeInConcatAxis[i]) {
        return i;
      }
    }
    return ${J}u;
  }`,GM=(J,Q)=>{let X=J.length,Y=[];for(let H=0;H<X;++H){let W=Q.setByOffset("global_idx",J[H].getByIndices("indices"));X===1?Y.push(W):H===0?Y.push(`if (inputIndex == ${H}u) { ${W} }`):H===X-1?Y.push(`else { ${W} }`):Y.push(`else if (inputIndex == ${H}) { ${W} }`)}return Y.join(`
`)},jM=(J,Q,X,Y)=>{let H=u.size(X),W=Array(J.length),G=Array(J.length),j=0,N=[],V=[],L=[{type:12,data:H}];for(let A=0;A<J.length;++A)j+=J[A].dims[Q],W[A]=j,V.push(J[A].dims.length),G[A]=i(`input${A}`,Y,V[A]),N.push("rank"),L.push({type:12,data:W[A]});for(let A=0;A<J.length;++A)L.push(...R0(J[A].dims));L.push(...R0(X));let B=B0("output",Y,X.length),U=B.indicesGet("indices",Q),E=Array.from(Array(W.length).keys()).map((A)=>`uniforms.sizeInConcatAxis${A}`).join(","),R=(A)=>`

  ${(()=>{A.registerUniform("outputSize","u32");for(let P=0;P<J.length;P++)A.registerUniform(`sizeInConcatAxis${P}`,"u32");return A.declareVariables(...G,B)})()}

  ${WM(W.length,E)}

  ${A.mainStart()}
    ${A.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

    var indices = ${B.offsetToIndices("global_idx")};

    let inputIndex = calculateInputIndex(${U});
    if (inputIndex != 0u) {
      let sizeInConcatAxis = array<u32, ${W.length}u>(${E});
      ${U} -= sizeInConcatAxis[inputIndex - 1u];
    }

    ${GM(G,B)}
  }`;return{name:"Concat",shaderCache:{hint:`${Q}`,inputDependencies:N},getRunData:()=>({outputs:[{dims:X,dataType:Y}],dispatchGroup:{x:Math.ceil(H/64)},programUniforms:L}),getShaderSource:R}},PO=(J,Q)=>{let X=J.inputs,Y=X[0].dims,H=u.normalizeAxis(Q.axis,Y.length);qM(X,H);let W=Y.slice();W[H]=X.reduce((j,N)=>j+(N.dims.length>H?N.dims[H]:0),0);let G=X.filter((j)=>u.size(j.dims)>0);J.compute(jM(G,H,W,X[0].dataType),{inputs:G})},SO=(J)=>d0({axis:J.axis})}),o8=Q0(()=>{z0(),w0(),p8=(J,Q,X="f32")=>{switch(J.activation){case"Relu":return`value = max(value, ${Q}(0.0));`;case"Sigmoid":return`value = (${Q}(1.0) / (${Q}(1.0) + exp(-value)));`;case"Clip":return`value = clamp(value, ${Q}(${X}(uniforms.clip_min)), ${Q}(${X}(uniforms.clip_max)));`;case"HardSigmoid":return`value = max(${Q}(0.0), min(${Q}(1.0), ${X}(uniforms.alpha) * value + ${X}(uniforms.beta)));`;case"LeakyRelu":return`value = select(${X}(uniforms.alpha) * value, value, value >= ${Q}(0.0));`;case"Tanh":return`let e2x = exp(-2.0 * abs(value));
              value = sign(value) * (1.0 - e2x) / (1.0 + e2x);
        `;case"":return"";default:throw Error(`Unsupported activation ${J.activation}`)}},c8=(J,Q)=>{J.activation==="Clip"?Q.push({type:1,data:J.clipMax},{type:1,data:J.clipMin}):J.activation==="HardSigmoid"?Q.push({type:1,data:J.alpha},{type:1,data:J.beta}):J.activation==="LeakyRelu"&&Q.push({type:1,data:J.alpha})},d8=(J,Q)=>{J.activation==="Clip"?Q.push({name:"clip_max",type:"f32"},{name:"clip_min",type:"f32"}):J.activation==="HardSigmoid"?Q.push({name:"alpha",type:"f32"},{name:"beta",type:"f32"}):J.activation==="LeakyRelu"&&Q.push({name:"alpha",type:"f32"})},qH=(J)=>{let Q=J?.activation||"";if(Q==="HardSigmoid"){let[X,Y]=J?.activation_params||[0.2,0.5];return{activation:Q,alpha:X,beta:Y}}else if(Q==="Clip"){let[X,Y]=J?.activation_params||[QU,XU];return{activation:Q,clipMax:Y,clipMin:X}}else if(Q==="LeakyRelu"){let[X]=J?.activation_params||[0.01];return{activation:Q,alpha:X}}return{activation:Q}}}),WH=Q0(()=>{B1=(J,Q)=>{switch(J){case 1:return Q;case 2:return`vec2<${Q}>`;case 3:return`vec3<${Q}>`;case 4:return`vec4<${Q}>`;default:throw Error(`${J}-component is not supported.`)}},ZO=(J)=>`
      ${J?"value = value + getBiasByOutputCoords(coords);":""}
      `}),hA=Q0(()=>{wO=(J)=>`
fn getIndexFromCoords4D(coords : vec4<i32>, shape : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
      shape.y * shape.z * shape.w, shape.z * shape.w, shape.w, 1));
}
fn getOutputIndexFromCoords(coords : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
    i32(${J}.x), i32(${J}.y), i32(${J}.z), 1));
}
`}),jH=Q0(()=>{z0(),w0(),I0(),o8(),n2=(J,Q,X,Y,H)=>{let W=Y-X;return`
      ${Array.from({length:X}).map((G,j)=>`
      if (${U0(Q.shape,j,Q.rank)} != 1) {
        ${Q.indicesSet(J,j,U0(H,j+W,Y))}
      } else {
        ${Q.indicesSet(J,j,0)}
      }`).join("")}
`},GH=(J,Q,X,Y,H=!1,W)=>{let G=J[0].dims,j=J[1].dims,N=G[G.length-2],V=j[j.length-1],L=G[G.length-1],B=e0(V),U=e0(L),E=e0(N),R=u.size(X)/B/E,A=J.length>2,P=Y?Y.slice(0,-2):X.slice(0,-2),z=[u.size(P),N,V],D=[{type:12,data:R},{type:12,data:N},{type:12,data:V},{type:12,data:L}];c8(Q,D),D.push(...R0(P,G,j)),A&&D.push(...R0(J[2].dims)),D.push(...R0(z));let S=(w)=>{let k=QH("batch_dims",J[0].dataType,P.length),I=i("a",J[0].dataType,G.length,U),C=i("b",J[1].dataType,j.length,B),T=B0("output",J[0].dataType,z.length,B),g=K1(T.type.tensor),m=p8(Q,T.type.value,g),l=[I,C],t="";if(A){let j0=H?B:1;l.push(i("bias",J[2].dataType,J[2].dims.length,j0)),t=`${H?`value += bias[col / ${j0}];`:`value += ${T.type.value}(bias[row + i]);`}`}let h=[{name:"output_size",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"}];d8(Q,h);let W0=()=>{let j0=`var a_data: ${I.type.value};`;for(let o=0;o<U;o++)j0+=`
              let b_data${o} = b[(b_offset + (k + ${o}) * uniforms.N + col) / ${B}];`;for(let o=0;o<E;o++){j0+=`a_data = a[(a_offset + (row + ${o}) * uniforms.K + k) / ${U}];`;for(let G0=0;G0<U;G0++)j0+=`
            values[${o}] = fma(${C.type.value}(a_data${U===1?"":`[${G0}]`}), b_data${G0}, values[${o}]);
`}return j0};return`
  ${w.registerUniforms(h).registerInternalVariables(k).declareVariables(...l,T)}
  ${w.mainStart()}
    ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let col = (global_idx % (uniforms.N / ${B})) * ${B};
    var index1 = global_idx / (uniforms.N / ${B});
    let stride1 = uniforms.M / ${E};
    let row = (index1 % stride1) * ${E};
    let batch = index1 / stride1;

    ${X.length===2?"":`let batch_indices = ${k.offsetToIndices("batch")};`}

    var a_indices: ${I.type.indices};
    ${n2("a_indices",I,I.rank-2,k.rank,"batch_indices")}
    ${I.indicesSet("a_indices",I.rank-2,0)}
    ${I.indicesSet("a_indices",I.rank-1,0)}
    let a_offset = ${I.indicesToOffset("a_indices")};

    var b_indices: ${C.type.indices};
    ${n2("b_indices",C,C.rank-2,k.rank,"batch_indices")}
    ${C.indicesSet("b_indices",C.rank-2,0)}
    ${C.indicesSet("b_indices",C.rank-1,0)}
    let b_offset = ${C.indicesToOffset("b_indices")};
    var values: array<${T.type.value}, ${E}>;
    for (var k: u32 = 0u; k < uniforms.K; k = k + ${U}) {
      ${W0()}
    }
    for (var i = 0u; i < ${E}u; i++) {
      var value = values[i];
      ${t}
      ${m}
      let cur_indices = ${T.type.indices}(batch, row + i, col);
      let offset = ${T.indicesToOffset("cur_indices")};
      ${T.setByOffset(`offset / ${B}`,"value")};
    }
  }
  `};return{name:"MatMulNaive",shaderCache:{hint:`${Q.activation};${B};${U};${E};${H}`,inputDependencies:A?["rank","rank","rank"]:["rank","rank"]},getRunData:()=>({outputs:[{dims:W?W(X):X,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(R/64)},programUniforms:D}),getShaderSource:S}}}),FH=Q0(()=>{z0(),w0(),I0(),o8(),jH(),WH(),FM=(J,Q)=>J?`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          kStart + inputRow,
          globalRowStart / innerElementSize + inputCol${Q?", batchIndices":""});
        `:`
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          globalRow + innerRow,
          kStart / innerElementSize + inputCol${Q?", batchIndices":""});
        `,NM=(J,Q)=>J?`
        let ACached0 = mm_Asub[k * innerElementSize][localRow];
        let ACached1 = mm_Asub[k * innerElementSize + 1][localRow];
        let ACached2 = mm_Asub[k * innerElementSize + 2][localRow];
        ${Q===3?"":"let ACached3 = mm_Asub[k * innerElementSize + 3][localRow];"}
        for (var i = 0; i < rowPerThread; i = i + 1) {
          acc[i] = BCached0 * ACached0[i] + acc[i];
          acc[i] = BCached1 * ACached1[i] + acc[i];
          acc[i] = BCached2 * ACached2[i] + acc[i];
          ${Q===3?"":"acc[i] = BCached3 * ACached3[i] + acc[i];"}
        }`:`
        for (var i = 0; i < rowPerThread; i = i + 1) {
          let ACached = mm_Asub[tileRow + i][k];
          acc[i] = BCached0 * ACached.x + acc[i];
          acc[i] = BCached1 * ACached.y + acc[i];
          acc[i] = BCached2 * ACached.z + acc[i];
          ${Q===3?"":"acc[i] = BCached3 * ACached.w + acc[i];"}
        }`,TY=(J,Q,X="f32",Y,H=!1,W=32,G=!1,j=32)=>{let N=Q[1]*J[1],V=Q[0]*J[0],L=H?N:W,B=H?W:N,U=L/Q[0],E=W/Q[1];if(!((H&&U===4&&J[1]===4||!H&&(U===3||U===4))&&L%Q[0]===0&&W%Q[1]===0&&J[0]===4))throw Error(`If transposeA ${H} is true, innerElementSize ${U} and workPerThread[1] ${J[1]} must be 4.
      Otherwise, innerElementSize ${U} must be 3 or 4.
  tileAWidth ${L} must be divisible by workgroupSize[0]${Q[0]}. tileInner ${W} must be divisible by workgroupSize[1] ${Q[1]}. colPerThread ${J[0]} must be 4.`);return`
var<workgroup> mm_Asub: array<array<vec${U}<${X}>, ${L/U}>, ${B}>;
var<workgroup> mm_Bsub: array<array<vec4<${X}>, ${V/J[0]}>, ${W}>;

const rowPerThread = ${J[1]};
const colPerThread = ${J[0]};
const innerElementSize = ${U};
const tileInner = ${W};

@compute @workgroup_size(${Q[0]}, ${Q[1]}, ${Q[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
  let localRow = i32(localId.y);
  let tileRow = localRow * rowPerThread;
  let tileCol = i32(localId.x);

  let globalRow =i32(globalId.y) * rowPerThread;
  let globalCol = i32(globalId.x);
  let batch = ${G?"0":"i32(globalId.z)"};
  ${Y?`let batchIndices = ${Y.offsetToIndices("u32(batch)")};`:""}
  let globalRowStart = i32(workgroupId.y) * ${N};

  let num_tiles = ${G?`${Math.ceil(j/W)}`:"(uniforms.dim_inner - 1) / tileInner + 1"};
  var kStart = ${G?`i32(globalId.z) * ${j}`:"0"};

  var acc: array<vec4<${X}>, rowPerThread>;

  // Loop over shared dimension.
  let tileRowB = localRow * ${E};
  for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let inputRow = tileRow + innerRow;
          let inputCol = tileCol;
          ${FM(H,Y)}
      }

      // Load one tile of B into local memory.
      for (var innerRow = 0; innerRow < ${E}; innerRow = innerRow + 1) {
          let inputRow = tileRowB + innerRow;
          let inputCol = tileCol;
          mm_Bsub[inputRow][inputCol] = mm_readB(batch, kStart + inputRow, globalCol${Y?", batchIndices":""});
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      for (var k = 0; k < tileInner / innerElementSize; k = k + 1) {
          let BCached0 = mm_Bsub[k * innerElementSize][tileCol];
          let BCached1 = mm_Bsub[k * innerElementSize + 1][tileCol];
          let BCached2 = mm_Bsub[k * innerElementSize + 2][tileCol];
          ${U===3?"":"let BCached3 = mm_Bsub[k * innerElementSize + 3][tileCol];"}

          ${NM(H,U)}
      }

      workgroupBarrier();
  }

  for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      mm_write(batch, globalRow + innerRow, globalCol, acc[innerRow]);
  }
}`},n3=(J,Q)=>J?`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              kStart + inputRow,
              globalRowStart + inputCol${Q?", batchIndices":""});
            `:`
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              globalRowStart + inputRow,
              kStart + inputCol${Q?", batchIndices":""});
            `,VM=(J)=>J?"let ACached = mm_Asub[k][tileRow + innerRow];":"let ACached = mm_Asub[tileRow + innerRow][k];",xY=(J,Q,X="f32",Y,H=!1,W=32,G=!1,j=32,N=!1)=>{let V=J[1]*Q[1],L=J[0]*Q[0],B=H?V:W,U=H?W:V;if(!(U%Q[1]===0&&B%Q[0]===0&&W%Q[1]===0))throw Error(`tileAHight ${U} must be divisible by workgroupSize[1]${Q[1]}, tileAWidth ${B} must be divisible by workgroupSize[0]${Q[0]}, tileInner ${W} must be divisible by workgroupSize[1]${Q[1]}`);let E=U/Q[1],R=B/Q[0],A=W/Q[1],P=N?`
    let localRow = i32(localId.y);
    let localCol = i32(localId.x);
    let globalRowStart = i32(workgroupId.y) * ${V};
    let globalColStart = i32(workgroupId.x) * ${L};

    // Loop over shared dimension.
    for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var inputRow = localRow; inputRow < ${U}; inputRow = inputRow + ${Q[1]}) {
        for (var inputCol = localCol; inputCol < ${B}; inputCol = inputCol + ${Q[0]}) {
          ${n3(H,Y)}
        }
      }
      // Load one tile of B into local memory.
      for (var inputRow = localRow; inputRow < ${W}; inputRow = inputRow + ${Q[1]}) {
            for (var inputCol = localCol; inputCol < ${L}; inputCol = inputCol + ${Q[0]}) {
          mm_Bsub[inputRow][inputCol] = mm_readB(batch,
            kStart + inputRow,
            globalColStart + inputCol${Y?", batchIndices":""});
        }
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      var BCached : array<${X}, colPerThread>;
      for (var k = 0; k < tileInner; k = k + 1) {
        for (var inner = 0; inner < colPerThread; inner = inner + 1) {
          BCached[inner] = mm_Bsub[k][localCol + inner * ${Q[0]}];
        }
        for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let ACached = ${H?`mm_Asub[k][localRow + innerRow * ${Q[1]}];`:`mm_Asub[localRow + innerRow * ${Q[1]}][k];`}
          for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
            acc[innerRow][innerCol] = acc[innerRow][innerCol] +
                ACached * BCached[innerCol];
          }
        }
      }
      workgroupBarrier();
    }
    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      let gRow = globalRowStart + localRow + innerRow * ${Q[1]};
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        let gCol = globalColStart + localCol + innerCol * ${Q[0]};
        mm_write(batch, gRow, gCol, acc[innerRow][innerCol]);
      }
    }
    `:`
let tileRow = i32(localId.y) * rowPerThread;
let tileCol = i32(localId.x) * colPerThread;

let globalRow = i32(globalId.y) * rowPerThread;
let globalCol = i32(globalId.x) * colPerThread;
let globalRowStart = i32(workgroupId.y) * ${V};

let tileRowA = i32(localId.y) * ${E};
let tileColA = i32(localId.x) * ${R};
let tileRowB = i32(localId.y) * ${A};
// Loop over shared dimension.
for (var t = 0; t < num_tiles; t = t + 1) {
  // Load one tile of A into local memory.
  for (var innerRow = 0; innerRow < ${E}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < ${R}; innerCol = innerCol + 1) {
      let inputRow = tileRowA + innerRow;
      let inputCol = tileColA + innerCol;
      ${n3(H,Y)}
    }
  }

  // Load one tile of B into local memory.
  for (var innerRow = 0; innerRow < ${A}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
      let inputRow = tileRowB + innerRow;
      let inputCol = tileCol + innerCol;
      mm_Bsub[inputRow][inputCol] = mm_readB(batch,
        kStart + inputRow,
        globalCol + innerCol${Y?", batchIndices":""});
    }
  }
  kStart = kStart + tileInner;
  workgroupBarrier();

  // Compute acc values for a single thread.
  var BCached : array<${X}, colPerThread>;
  for (var k = 0; k < tileInner; k = k + 1) {
    for (var inner = 0; inner < colPerThread; inner = inner + 1) {
      BCached[inner] = mm_Bsub[k][tileCol + inner];
    }

    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      ${VM(H)}
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        acc[innerRow][innerCol] = acc[innerRow][innerCol] + ACached * BCached[innerCol];
      }
    }
  }

  workgroupBarrier();
}

for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
  for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
    mm_write(batch, globalRow + innerRow, globalCol + innerCol,
        acc[innerRow][innerCol]);
  }
}
`;return`
  var<workgroup> mm_Asub : array<array<${X}, ${B}>, ${U}>;
  var<workgroup> mm_Bsub : array<array<${X}, ${L}>, ${W}>;
  const rowPerThread = ${J[1]};
  const colPerThread = ${J[0]};
  const tileInner = ${W};

@compute @workgroup_size(${Q[0]}, ${Q[1]}, ${Q[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
    let batch = ${G?"0":"i32(globalId.z)"};
    ${Y?`let batchIndices = ${Y.offsetToIndices("u32(batch)")};`:""}
    let num_tiles = ${G?`${Math.ceil(j/W)}`:"(uniforms.dim_inner - 1) / tileInner + 1"};
    var kStart = ${G?`i32(globalId.z) * ${j}`:"0"};

    var acc : array<array<${X}, colPerThread>, rowPerThread>;
    ${P}
  }
`},KM=(J,Q,X,Y,H=!1)=>{let[W,G,j,N]=Y,V=K1(Y[0].type.tensor);return`
    fn mm_readA(batch: i32, row: i32, colIn: i32, batchIndices: ${W.type.indices}) -> ${B1(J,V)} {
      var value = ${B1(J,V)}(0.0);
      let col = colIn * ${J};
      if(row < uniforms.dim_a_outer && col < uniforms.dim_inner)
      {
        var aIndices: ${G.type.indices};
        ${n2("aIndices",G,G.rank-2,W.rank,"batchIndices")}
        ${G.indicesSet("aIndices",G.rank-2,"u32(row)")}
        ${G.indicesSet("aIndices",G.rank-1,"u32(colIn)")}
        value = ${G.getByIndices("aIndices")};
      }
      return value;
    }

    fn mm_readB(batch: i32, row: i32, colIn: i32, batchIndices: ${W.type.indices}) -> ${B1(J,V)} {
      var value = ${B1(J,V)}(0.0);
      let col = colIn * ${J};
      if(row < uniforms.dim_inner && col < uniforms.dim_b_outer)
      {
        var bIndices: ${j.type.indices};
        ${n2("bIndices",j,j.rank-2,W.rank,"batchIndices")}
        ${j.indicesSet("bIndices",j.rank-2,"u32(row)")}
        ${j.indicesSet("bIndices",j.rank-1,"u32(colIn)")}
        value = ${j.getByIndices("bIndices")};
      }
      return value;
    }

    fn mm_write(batch: i32, row: i32, colIn: i32, valueIn: ${B1(J,V)}) {
      let col = colIn * ${J};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer) {
        var value = valueIn;
        let coords = vec3<i32>(batch, row, colIn);
        ${Q?`value = value + ${H?"bias[colIn]":`${B1(J,V)}(bias[row])`};`:""}
        ${X}
        ${N.setByIndices("vec3<u32>(coords)","value")}
      }
    }
    `},N4=(J,Q,X,Y,H=!1,W)=>{let G=J[0].dims,j=J[1].dims,N=G.slice(0,-2),V=j.slice(0,-2),L=Y?Y.slice(0,-2):X.slice(0,-2),B=u.size(L),U=G[G.length-2],E=G[G.length-1],R=j[j.length-1],A=E%4===0&&R%4===0,P=U<=8?[4,1,1]:[4,4,1],z=[8,8,1],D=[Math.ceil(R/z[0]/P[0]),Math.ceil(U/z[1]/P[1]),Math.ceil(B/z[2]/P[2])],S=A?4:1,w=[...N,U,E/S],k=w.length,I=[...V,E,R/S],C=I.length,T=[B,U,R/S],g=[{type:6,data:U},{type:6,data:R},{type:6,data:E}];c8(Q,g),g.push(...R0(L,w,I));let m=["rank","rank"],l=J.length>2;l&&(g.push(...R0(J[2].dims)),m.push("rank")),g.push(...R0(T));let t=(h)=>{let W0=L.length,j0=QH("batchDims",J[0].dataType,W0,1),o=K1(J[0].dataType),G0=i("a",J[0].dataType,k,S),F0=i("b",J[1].dataType,C,S),s=B0("result",J[0].dataType,T.length,S),N0=[G0,F0];if(l){let k0=H?S:1;N0.push(i("bias",J[2].dataType,J[2].dims.length,k0))}let f=[{name:"dim_a_outer",type:"i32"},{name:"dim_b_outer",type:"i32"},{name:"dim_inner",type:"i32"}];d8(Q,f);let p=K1(s.type.tensor),v=p8(Q,s.type.value,p),r=KM(S,l,v,[j0,G0,F0,s],H);return`
  ${h.registerUniforms(f).registerInternalVariables(j0).declareVariables(...N0,s)}
  ${r}
  ${A?TY(P,z,o,j0):xY(P,z,o,j0)}
                   `};return{name:"MatMul",shaderCache:{hint:`${P};${Q.activation};${A};${H}`,inputDependencies:m},getRunData:()=>({outputs:[{dims:W?W(X):X,dataType:J[0].dataType}],dispatchGroup:{x:D[0],y:D[1],z:D[2]},programUniforms:g}),getShaderSource:t}}}),yA=Q0(()=>{z0(),h6(),I0(),o8(),WH(),hA(),FH(),MM=(J,Q,X,Y,H=!1,W,G=4,j=4,N=4,V="f32")=>{let L=(g)=>{switch(g){case 1:return"resData = x[xIndex];";case 3:return`resData = vec3<${V}>(x[xIndex], x[xIndex + 1], x[xIndex + 2]);`;case 4:return"resData = x[xIndex / 4];";default:throw Error(`innerElementSize ${g} is not supported.`)}},B=(g)=>{switch(g){case 1:return"return w[row * i32(uniforms.w_shape[3]) + colIn];";case 4:return"return w[row * i32(uniforms.w_shape[3]) / 4 + colIn];";default:throw Error(`innerElementSize ${g} is not supported.`)}},U=J?`
    let coord = vec4<i32>(batch, xRow, xCol, xCh);
    `:`
    let coord = vec4<i32>(batch, xCh, xRow, xCol);
    `,E=J?`
    let coords = vec4<i32>(
      batch,
      row / outWidth,
      row % outWidth,
      col);
    `:`
    let coords = vec4<i32>(
      batch,
      row,
      col / outWidth,
      col % outWidth);
    `,R=J?"i32(uniforms.x_shape[1])":"i32(uniforms.x_shape[2])",A=J?"i32(uniforms.x_shape[2])":"i32(uniforms.x_shape[3])",P=J?"row":"col",z=J?"col":"row",D=`
    let inChannels = i32(uniforms.w_shape[2]);
    let outWidth = ${J?"i32(uniforms.result_shape[2])":"i32(uniforms.result_shape[3])"};
    let outRow = ${P} / outWidth;
    let outCol = ${P} % outWidth;

    let WRow = ${z} / (i32(uniforms.w_shape[1]) * inChannels);
    let WCol = ${z} / inChannels % i32(uniforms.w_shape[1]);
    let xRow = outRow * uniforms.stride[0] + uniforms.dilation[0] * WRow - uniforms.pad[0];
    let xCol = outCol * uniforms.stride[1] + uniforms.dilation[1] * WCol - uniforms.pad[1];
    let xCh = ${z} % inChannels;
    var resData = ${B1(G,V)}(0.0);
    // The bounds checking is always needed since we use it to pad zero for
    // the 'same' padding type.
    if (xRow >= 0 && xRow < ${R} && xCol >= 0 && xCol < ${A}) {
      ${U}
      let xIndex = getIndexFromCoords4D(coord, vec4<i32>(uniforms.x_shape));
      ${L(G)}
    }
    return resData;`,S=J?Q&&Y?`
    let col = colIn * ${G};
    ${D}`:`
    let col = colIn * ${G};
    if (row < uniforms.dim_a_outer && col < uniforms.dim_inner) {
      ${D}
    }
    return ${B1(G,V)}(0.0);`:Y&&X?`
    let col = colIn * ${G};
    ${D}`:`
    let col = colIn * ${G};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${D}
    }
    return ${B1(G,V)}(0.0);`,w=J?Y&&X?B(j):`
    let col = colIn * ${j};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${B(j)}
    }
    return ${B1(j,V)}(0.0);`:`
    let col = colIn * ${j};
    if (row < uniforms.dim_inner && col < uniforms.dim_a_outer) {
      ${B(j)}
    }
    return ${B1(j,V)}(0.0);`,k=B1(N,V),I=J?B1(G,V):B1(j,V),C=J?B1(j,V):B1(G,V),T=p8(W,k,V);return`
    fn mm_readA(batch: i32, row : i32, colIn : i32) -> ${I} {
      ${J?S:w}
    }

    fn mm_readB(batch: i32, row : i32, colIn : i32) -> ${C} {
      ${J?w:S}
    }

    fn mm_write(batch: i32, row : i32, colIn : i32, valueIn : ${k}) {
      let col = colIn * ${N};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer)
      {
      var value = valueIn;
      let outWidth = ${J?"i32(uniforms.result_shape[2])":"i32(uniforms.result_shape[3])"};
      ${E}
      ${ZO(H)}
      ${T}
      setOutputAtCoords(coords[0], coords[1], coords[2], coords[3], value);
      }
    }`},kO=(J,Q,X,Y,H,W,G,j,N)=>{let V=Q.format==="NHWC",L=V?J[0].dims[3]:J[0].dims[1],B=X[0],U=V?X[2]:X[3],E=V?X[1]:X[2],R=V?X[3]:X[1],A=V&&(L%4===0||L%3===0)&&R%4===0,P=V?R:U*E,z=V?U*E:R,D=[8,8,1],S=Y<=8?[4,1,1]:[4,4,1],w=[Math.ceil(P/D[0]/S[0]),Math.ceil(z/D[1]/S[1]),Math.ceil(B/D[2]/S[2])];f0("verbose",()=>`[conv2d_mm_webgpu] dispatch = ${w}`);let k=A?V&&L%4!==0?3:4:1,I=D[1]*S[1],C=D[0]*S[0],T=Math.max(D[0]*k,D[1]),g=Y%I===0,m=H%C===0,l=W%T===0,t=A?[k,4,4]:[1,1,1],h=[{type:6,data:Y},{type:6,data:H},{type:6,data:W},{type:6,data:[Q.pads[0],Q.pads[1]]},{type:6,data:Q.strides},{type:6,data:Q.dilations}];c8(Q,h),h.push(...R0(J[0].dims,J[1].dims));let W0=["rank","rank"];G&&(h.push(...R0(J[2].dims)),W0.push("rank")),h.push(...R0(X));let j0=(o)=>{let G0=[{name:"dim_a_outer",type:"i32"},{name:"dim_b_outer",type:"i32"},{name:"dim_inner",type:"i32"},{name:"pad",type:"i32",length:2},{name:"stride",type:"i32",length:2},{name:"dilation",type:"i32",length:2}];d8(Q,G0);let F0=A?4:1,s=K1(J[0].dataType),N0=`
      fn setOutputAtIndex(flatIndex : i32, value : ${A?`vec4<${s}>`:s}) {
        result[flatIndex] = ${A?`vec4<${s}>`:s}(value);
      }
      fn setOutputAtCoords(d0 : i32, d1 : i32, d2 : i32, d3 : i32, value : ${A?`vec4<${s}>`:s}) {
        let flatIndex = getOutputIndexFromCoords(vec4<i32>(d0, d1, d2, d3));
        setOutputAtIndex(flatIndex ${A?"/ 4":""}, value);
      }`,f=i("x",J[0].dataType,J[0].dims.length,k===3?1:k),p=i("w",J[1].dataType,J[1].dims.length,F0),v=[f,p],r=B0("result",J[0].dataType,X.length,F0);if(G){let k0=i("bias",J[2].dataType,J[2].dims.length,F0);v.push(k0),N0+=`
        fn getBiasByOutputCoords(coords : vec4<i32>) -> ${A?`vec4<${s}>`:s} {
          return bias[coords.${V?"w":"y"}${A?"/ 4":""}];
        }`}return`
        ${wO("uniforms.result_strides")}
        //struct Uniforms { xShape : vec4<i32>, wShape : vec4<i32>, outShape : vec4<i32>,
        //  outShapeStrides: vec3<i32>, filterDims : vec2<i32>, pad : vec2<i32>, stride : vec2<i32>,
        //  dilation : vec2<i32>, dimAOuter : i32, dimBOuter : i32, dimInner : i32 };
        ${o.registerUniforms(G0).declareVariables(...v,r)}
        ${N0}
        ${MM(V,g,m,l,G,Q,t[0],t[1],t[2],s)}
        ${A?TY(S,D,s,void 0,!V,T):xY(S,D,s,void 0,!V,T,!1,void 0,j)}`};return{name:"Conv2DMatMul",shaderCache:{hint:`${Q.cacheKey};${k};${A};${g};${m};${l};${I};${C};${T}`,inputDependencies:W0},getRunData:()=>({outputs:[{dims:N?N(X):X,dataType:J[0].dataType}],dispatchGroup:{x:w[0],y:w[1],z:w[2]},programUniforms:h}),getShaderSource:j0}}}),gA=Q0(()=>{z0(),h6(),w0(),I0(),o8(),WH(),BM=(J)=>{let Q=1;for(let X=0;X<J.length;X++)Q*=J[X];return Q},r3=(J)=>typeof J=="number"?[J,J,J]:J,m2=(J,Q)=>Q<=1?J:J+(J-1)*(Q-1),LM=(J,Q,X,Y=1)=>{let H=m2(Q,Y);return Math.floor((J[0]*(X-1)-X+H)/2)},t3=(J,Q,X,Y,H)=>{H==null&&(H=LM(J,Q[0],Y[0]));let W=[0,0,0,X];for(let G=0;G<3;G++)J[G]+2*H>=Q[G]&&(W[G]=Math.trunc((J[G]-Q[G]+2*H)/Y[G]+1));return W},UM=(J,Q,X,Y,H,W,G,j,N,V)=>{let L,B,U,E;if(J==="VALID"&&(J=0),typeof J=="number"){L={top:J,bottom:J,left:J,right:J,front:J,back:J};let R=t3([Q,X,Y,1],[j,N,V],1,[H,W,G],J);B=R[0],U=R[1],E=R[2]}else if(Array.isArray(J)){if(!J.every((A,P,z)=>A===z[0]))throw Error(`Unsupported padding parameter: ${J}`);L={top:J[0],bottom:J[1],left:J[2],right:J[3],front:J[4],back:J[5]};let R=t3([Q,X,Y,1],[j,N,V],1,[H,W,G],J[0]);B=R[0],U=R[1],E=R[2]}else if(J==="SAME_UPPER"){B=Math.ceil(Q/H),U=Math.ceil(X/W),E=Math.ceil(Y/G);let R=(B-1)*H+j-Q,A=(U-1)*W+N-X,P=(E-1)*G+V-Y,z=Math.floor(R/2),D=R-z,S=Math.floor(A/2),w=A-S,k=Math.floor(P/2),I=P-k;L={top:S,bottom:w,left:k,right:I,front:z,back:D}}else throw Error(`Unknown padding parameter: ${J}`);return{padInfo:L,outDepth:B,outHeight:U,outWidth:E}},CO=(J,Q,X,Y,H,W=!1,G="channelsLast")=>{let j,N,V,L,B;if(G==="channelsLast")[j,N,V,L,B]=J;else if(G==="channelsFirst")[j,B,N,V,L]=J;else throw Error(`Unknown dataFormat ${G}`);let[U,,E,R,A]=Q,[P,z,D]=r3(X),[S,w,k]=r3(Y),I=m2(E,S),C=m2(R,w),T=m2(A,k),{padInfo:g,outDepth:m,outHeight:l,outWidth:t}=UM(H,N,V,L,P,z,D,I,C,T),h=W?U*B:U,W0=[0,0,0,0,0];return G==="channelsFirst"?W0=[j,h,m,l,t]:G==="channelsLast"&&(W0=[j,m,l,t,h]),{batchSize:j,dataFormat:G,inDepth:N,inHeight:V,inWidth:L,inChannels:B,outDepth:m,outHeight:l,outWidth:t,outChannels:h,padInfo:g,strideDepth:P,strideHeight:z,strideWidth:D,filterDepth:E,filterHeight:R,filterWidth:A,effectiveFilterDepth:I,effectiveFilterHeight:C,effectiveFilterWidth:T,dilationDepth:S,dilationHeight:w,dilationWidth:k,inShape:J,outShape:W0,filterShape:Q}},IO=(J,Q,X,Y,H,W)=>{let G=W==="channelsLast",j=G?J[0].dims[3]:J[0].dims[1],N=!1,V=[64,1,1],L={x:X.map((D,S)=>S)},B=[Math.ceil(BM(L.x.map((D)=>X[D]))/V[0]),1,1];f0("verbose",()=>`[conv3d_naive_webgpu] dispatch = ${B}`);let U=N?G&&j%4!==0?3:4:1,E=u.size(X),R=[{type:12,data:E},{type:12,data:Y},{type:12,data:H},{type:12,data:Q.strides},{type:12,data:Q.dilations}];c8(Q,R),R.push(...R0(J[0].dims,J[1].dims));let A=["rank","rank"],P=J.length===3;P&&(R.push(...R0(J[2].dims)),A.push("rank")),R.push(...R0(X));let z=(D)=>{let S=[{name:"output_size",type:"u32"},{name:"filter_dims",type:"u32",length:Y.length},{name:"pads",type:"u32",length:H.length},{name:"strides",type:"u32",length:Q.strides.length},{name:"dilations",type:"u32",length:Q.dilations.length}];d8(Q,S);let w=N?4:1,k=K1(J[0].dataType),I=i("x",J[0].dataType,J[0].dims.length,U===3?1:U),C=i("W",J[1].dataType,J[1].dims.length,w),T=[I,C],g=B0("result",J[0].dataType,X.length,w),m="";if(P){let h=i("bias",J[2].dataType,J[2].dims.length,w);T.push(h),m+=`
        fn getBiasByOutputCoords(coords : array<u32, 5>) -> ${N?`vec4<${k}>`:k} {
          return bias[${G?U0("coords",4,5):U0("coords",1,5)}${N?"/ 4":""}];
        }`}let l=B1(U,k),t=p8(Q,l,k);return`
            ${m}
            fn getX(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> f32 {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${I.getByIndices("aIndices")};
            }
            fn getW(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> f32 {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${C.getByIndices("aIndices")};
            }
          ${D.registerUniforms(S).declareVariables(...T,g)}
          ${D.mainStart()}
          ${D.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
              let coords = ${g.offsetToIndices("global_idx")};
              let batch = ${U0("coords",0,I.rank)};
              let d2 = ${G?U0("coords",I.rank-1,I.rank):U0("coords",1,I.rank)};
              let xFRCCorner = vec3<u32>(${G?U0("coords",1,I.rank):U0("coords",2,I.rank)},
              ${G?U0("coords",2,I.rank):U0("coords",3,I.rank)},
              ${G?U0("coords",3,I.rank):U0("coords",4,I.rank)}) * uniforms.strides - uniforms.pads;
              let xFCorner = xFRCCorner.x;
              let xRCorner = xFRCCorner.y;
              let xCCorner = xFRCCorner.z;
              let xShapeY = ${G?U0("uniforms.x_shape",1,I.rank):U0("uniforms.x_shape",2,I.rank)};
              let xShapeZ = ${G?U0("uniforms.x_shape",2,I.rank):U0("uniforms.x_shape",3,I.rank)};
              let xShapeW = ${G?U0("uniforms.x_shape",3,I.rank):U0("uniforms.x_shape",4,I.rank)};
              let xShapeU = ${G?U0("uniforms.x_shape",4,I.rank):U0("uniforms.x_shape",1,I.rank)};
              let inputDepthNearestVec4 = (xShapeU / 4) * 4;
              let inputDepthVec4Remainder = xShapeU % 4;

              var value = 0.0;
              for (var wF = 0u; wF < uniforms.filter_dims[0]; wF++) {
                let xF = xFCorner + wF * uniforms.dilations[0];
                if (xF < 0 || xF >= xShapeY) {
                  continue;
                }

                for (var wR = 0u; wR < uniforms.filter_dims[1]; wR++) {
                  let xR = xRCorner + wR * uniforms.dilations[1];
                  if (xR < 0 || xR >= xShapeZ) {
                    continue;
                  }

                  for (var wC = 0u; wC < uniforms.filter_dims[2]; wC++) {
                    let xC = xCCorner + wC * uniforms.dilations[2];
                    if (xC < 0 || xC >= xShapeW) {
                      continue;
                    }

                    for (var d1 = 0u; d1 < inputDepthNearestVec4; d1 += 4) {
                      ${G?`let xValues = vec4<f32>(
                               getX(batch, xF, xR, xC, d1),
                               getX(batch, xF, xR, xC, d1 + 1),
                               getX(batch, xF, xR, xC, d1 + 2),
                               getX(batch, xF, xR, xC, d1 + 3));
                            `:`let xValues = vec4<f32>(
                               getX(batch, d1, xF, xR, xC),
                               getX(batch, d1 + 1, xF, xR, xC),
                               getX(batch, d1 + 2, xF, xR, xC),
                               getX(batch, d1 + 3, xF, xR, xC));
                            `}
                            let wValues = vec4<f32>(
                              getW(d2, d1, wF, wR, wC),
                              getW(d2, d1 + 1, wF, wR, wC),
                              getW(d2, d1 + 2, wF, wR, wC),
                              getW(d2, d1 + 3, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                    if (inputDepthVec4Remainder == 1) {
                        ${G?`value += getX(batch, xF, xR, xC, inputDepthNearestVec4)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`:`value += getX(batch, inputDepthNearestVec4, xF, xR, xC)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`}
                    } else if (inputDepthVec4Remainder == 2) {
                      ${G?`let xValues = vec2<f32>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1));
                      `:`let xValues = vec2<f32>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC));
                    `}
                    let wValues = vec2<f32>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC));
                      value += dot(xValues, wValues);
                    } else if (inputDepthVec4Remainder == 3) {
                      ${G?`let xValues = vec3<f32>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 2));
                      `:`let xValues = vec3<f32>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 2, xF, xR, xC));
                    `}
                    let wValues = vec3<f32>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 2, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                  }
                }
              }
              ${P?"value = value + getBiasByOutputCoords(coords)":""};
              ${t}
              result[global_idx] = f32(value);
          }`};return{name:"Conv3DNaive",shaderCache:{hint:`${Q.cacheKey};${G};${U};${P}`,inputDependencies:A},getRunData:()=>({outputs:[{dims:X,dataType:J[0].dataType}],dispatchGroup:{x:B[0],y:B[1],z:B[2]},programUniforms:R}),getShaderSource:z}}}),lA=Q0(()=>{z0(),w0(),I0(),o8(),_O=(J,Q,X,Y)=>{let H=J.length>2,W=H?"value += b[output_channel];":"",G=J[0].dims,j=J[1].dims,N=Q.format==="NHWC",V=N?X[3]:X[1],L=V/Q.group,B=N&&L>=4?e0(V):1,U=u.size(X)/B,E=[{type:12,data:U},{type:12,data:Q.dilations},{type:12,data:[Q.strides[0],Q.strides[1]]},{type:12,data:[Q.pads[0],Q.pads[1]]},{type:12,data:L}];c8(Q,E),E.push(...R0(G,[j[0],j[1],j[2],j[3]/B]));let R=H?["rank","rank","rank"]:["rank","rank"];E.push(...R0([X[0],X[1],X[2],X[3]/B]));let A=(P)=>{let z=B0("output",J[0].dataType,X.length,B),D=K1(z.type.tensor),S=p8(Q,z.type.value,D),w=i("x",J[0].dataType,G.length),k=i("w",J[1].dataType,j.length,B),I=[w,k];H&&I.push(i("b",J[2].dataType,J[2].dims,B));let C=[{name:"output_size",type:"u32"},{name:"dilations",type:"u32",length:Q.dilations.length},{name:"strides",type:"u32",length:2},{name:"pads",type:"u32",length:2},{name:"output_channels_per_group",type:"u32"}];d8(Q,C);let T=N?`
      for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[0]; wHeight++) {
        let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

        if (xHeight < 0u || xHeight >= uniforms.x_shape[1]) {
          continue;
        }

        for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[1]; wWidth++) {
          let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
          if (xWidth < 0u || xWidth >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[2]; wInChannel++) {
            let input_channel = in_channel_offset + wInChannel;
            let xVal = ${w.get("batch","xHeight","xWidth","input_channel")};
            let wVal = ${k.get("wHeight","wWidth","wInChannel","output_channel")};
            value += xVal * wVal;
          }
        }
      }
      `:`
      for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[1]; wInChannel++) {
        let input_channel = in_channel_offset + wInChannel;
        for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[2]; wHeight++) {
          let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

          if (xHeight < 0u || xHeight >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[3]; wWidth++) {
            let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
            if (xWidth < 0u || xWidth >= uniforms.x_shape[3]) {
              continue;
            }

            let xVal = ${w.get("batch","input_channel","xHeight","xWidth")};
            let wVal = ${k.get("output_channel","wInChannel","wHeight","wWidth")};
            value += xVal * wVal;
          }
        }
      }
      `;return`
  ${P.registerUniforms(C).declareVariables(...I,z)}

  ${P.mainStart()}
    ${P.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let outputIndices = ${z.offsetToIndices("global_idx")};
    let batch: u32 = outputIndices[0];
    let output_channel: u32 = outputIndices[${N?3:1}];
    let xRCCorner: vec2<u32> = vec2<u32>(outputIndices[${N?1:2}], outputIndices[${N?2:3}]) * uniforms.strides - uniforms.pads;
    let group_id: u32 = output_channel * ${B} / uniforms.output_channels_per_group;
    var in_channel_offset = group_id * uniforms.w_shape[${N?2:1}];

    var value: ${z.type.value} = ${z.type.value}(0);
    ${T}
    ${W}
    ${S}
    ${z.setByOffset("global_idx","value")}
  }`};return{name:"GroupedConv",shaderCache:{hint:`${Q.cacheKey}_${B}`,inputDependencies:R},getRunData:()=>({outputs:[{dims:Y?Y(X):X,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(U/64)},programUniforms:E}),getShaderSource:A}},bO=(J,Q,X,Y)=>{let H=J.length>2,W=e0(X[3]),G=e0(X[2]),j=u.size(X)/W/G,N=[J[0].dims[0],J[0].dims[1],J[0].dims[2],J[0].dims[3]/W],V=[J[1].dims[0],J[1].dims[1],J[1].dims[2],J[1].dims[3]/W],L=[X[0],X[1],X[2],X[3]/W],B=[{type:12,data:j},{type:6,data:[Q.strides[0],Q.strides[1]]},{type:6,data:[Q.pads[0],Q.pads[1]]}];c8(Q,B),B.push(...R0(N,V,L));let U=(G-1)*Q.strides[1]+V[1],E=(R)=>{let A=B0("output",J[0].dataType,L.length,W),P=K1(A.type.tensor),z=p8(Q,A.type.value,P),D=i("x",J[0].dataType,N.length,W),S=i("w",J[1].dataType,V.length,W),w=[D,S];H&&w.push(i("b",J[2].dataType,J[2].dims,W));let k=H?"value += b[output_channel];":"",I=[{name:"output_size",type:"u32"},{name:"strides",type:"i32",length:2},{name:"pads",type:"i32",length:2}];return d8(Q,I),`
  ${R.registerUniforms(I).declareVariables(...w,A)}
  ${R.mainStart()}
    ${R.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let width0 = uniforms.output_shape[3];
    let output_channel = global_idx % width0;
    var index1 = global_idx / width0;
    let width1 = uniforms.output_shape[2] / ${G}u;
    let col = (index1 % width1) * ${G}u;
    index1 = index1 / width1;
    let row = index1 % uniforms.output_shape[1];
    let batch = index1 / uniforms.output_shape[1];

    let x_corner = vec2<i32>(i32(row), i32(col)) * uniforms.strides - uniforms.pads;

    var x_vals: array<${D.type.value}, ${U}>;
    var values: array<${A.type.value}, ${G}>;
    let input_channel = output_channel;
    // Use constant instead of uniform can give better performance for w's height/width.
    for (var w_height: u32 = 0u; w_height < ${V[0]}; w_height++) {
      let x_height = x_corner.x + i32(w_height);
      if (x_height >= 0 && u32(x_height) < uniforms.x_shape[1]) {
        for (var i = 0; i < ${U}; i++) {
          let x_width = x_corner.y + i;
          if (x_width >= 0 && u32(x_width) < uniforms.x_shape[2]) {
            x_vals[i] = ${D.get("batch","u32(x_height)","u32(x_width)","input_channel")};
          } else {
            x_vals[i] = ${D.type.value}(0);
          }
        }
        for (var w_width: u32 = 0u; w_width < ${V[1]}; w_width++) {
          let w_val = ${S.get("w_height","w_width","0","output_channel")};
          for (var i = 0u; i < ${G}u; i++) {
            values[i] = fma(x_vals[i * u32(uniforms.strides[1]) + w_width], w_val, values[i]);
          }
        }
      }
    }

    for (var i = 0u; i < ${G}u; i++) {
      var value = values[i];
      ${k}
      ${z}
      ${A.set("batch","row","col + i","output_channel","value")};
    }
  }`};return{name:"GroupedConv-Vectorize",shaderCache:{hint:`${Q.cacheKey};${W};${G};${U};${V[0]};${V[1]}`,inputDependencies:H?["rank","rank","type"]:["rank","rank"]},getRunData:()=>({outputs:[{dims:Y?Y(X):X,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(j/64)},programUniforms:B}),getShaderSource:E}}}),mA=Q0(()=>{w0(),yA(),gA(),FH(),lA(),o8(),jH(),n6(),OM=(J,Q,X,Y,H,W)=>{let G=J[0],j=J.slice(W?1:2,W?3:4),N=j.length,V=Q[0],L=Q.slice(2).map((U,E)=>U+(U-1)*(X[E]-1)),B=j.map((U,E)=>U+Y[E]+Y[E+N]).map((U,E)=>Math.floor((U-L[E]+H[E])/H[E]));return B.splice(0,0,G),B.splice(W?3:1,0,V),B},r5=[2,3,1,0],RM=(J,Q)=>{if(!J||J.length!==2&&J.length!==3)throw Error("Conv requires 2 or 3 inputs");if(J[0].dims.length>5)throw Error("greater than 5D is not supported");if(J[0].dims.length!==J[1].dims.length)throw Error("filter does not have same dimension as input");let X=J[0].dims[Q.format==="NHWC"?J[0].dims.length-1:1],Y=J[1].dims[1]*Q.group;if(X!==Y)throw Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");if(J.length===3&&(J[2].dims.length!==1||J[1].dims[0]!==J[2].dims[0]))throw Error("invalid bias");let H=J[0].dims.length-2;if(Q.dilations.length!==H)throw Error(`dilations should be ${H}D`);if(Q.strides.length!==H)throw Error(`strides should be ${H}D`);if(Q.pads.length!==H*2)throw Error(`pads should be ${H*2}D`);if(Q.kernelShape.length!==0&&Q.kernelShape.length!==J[1].dims.length-2)throw Error("invalid kernel shape")},t5=(J,Q)=>{let X=J.kernelShape.slice();X.length<Q[1].dims.length-2&&X.push(...Array(Q[1].dims.length-2-X.length).fill(0));for(let W=2;W<Q[1].dims.length;++W)X[W-2]===0&&(X[W-2]=Q[1].dims[W]);let Y=J.pads.slice();j4.adjustPadsBasedOnAutoPad(Q[0].dims,J.strides,J.dilations,X,Y,J.format==="NHWC",J.autoPad);let H=Object.assign({},J);return Object.assign(H,{kernelShape:X,pads:Y}),H},fY=(J)=>{let Q=qH(J),X=J.format,Y=["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][J.auto_pad],H=J.dilations,W=J.group,G=J.kernel_shape,j=J.pads,N=J.strides,V=J.w_is_const();return{autoPad:Y,format:X,dilations:H,group:W,kernelShape:G,pads:j,strides:N,wIsConst:V,...Q,cacheKey:`${J.format};${Q.activation};`}},e3=(J,Q,X,Y)=>{let H=X.format==="NHWC",W=OM(Q[0].dims,Q[1].dims,X.dilations,X.pads,X.strides,H);if(X.group!==1){let I=[Q[0]];if(H){let C=J.kernelCustomData.wT??J.compute(y1(Q[1],r5),{inputs:[1],outputs:[X.wIsConst?-2:-1]})[0];X.wIsConst&&!J.kernelCustomData.wT&&(J.kernelCustomData.wT=C),I.push(C)}else I.push(Q[1]);Q.length===3&&I.push(Q[2]),!J.adapterInfo.isArchitecture("ampere")&&H&&Q[1].dims[0]===X.group&&Q[1].dims[1]===1&&X.dilations[0]===1&&X.dilations[1]===1?J.compute(bO(I,X,W,Y),{inputs:I}):J.compute(_O(I,X,W,Y),{inputs:I});return}let G=Q.length===3,j=Q[0].dims[H?1:2],N=Q[0].dims[H?2:3],V=Q[0].dims[H?3:1],L=Q[1].dims[2],B=Q[1].dims[3],U=W[H?1:2],E=W[H?2:3],R=W[H?3:1],A=H&&L===j&&B===N&&X.pads[0]===0&&X.pads[1]===0;if(A||L===1&&B===1&&X.dilations[0]===1&&X.dilations[1]===1&&X.strides[0]===1&&X.strides[1]===1&&X.pads[0]===0&&X.pads[1]===0){let I=W[0],C,T,g,m=[];if(H){let h=J.kernelCustomData.wT??J.compute(y1(Q[1],r5),{inputs:[1],outputs:[X.wIsConst?-2:-1]})[0];if(X.wIsConst&&!J.kernelCustomData.wT&&(J.kernelCustomData.wT=h),A){let W0=j*N*V;C=Q[0].reshape([1,I,W0]),T=h.reshape([1,W0,R]),g=[1,I,R]}else C=Q[0].reshape([I,j*N,V]),T=h.reshape([1,V,R]),g=[I,U*E,R];m.push(C),m.push(T)}else C=Q[0].reshape([I,V,j*N]),T=Q[1].reshape([1,R,V]),g=[I,R,U*E],m.push(T),m.push(C);G&&m.push(Q[2]);let l=g[2],t=m[0].dims[m[0].dims.length-1];l<8&&t<8?J.compute(GH(m,X,W,g,H,Y),{inputs:m}):J.compute(N4(m,X,W,g,H,Y),{inputs:m});return}let P=!0,z=J.kernelCustomData.wT??J.compute(y1(Q[1],r5),{inputs:[1],outputs:[X.wIsConst?-2:-1]})[0];X.wIsConst&&!J.kernelCustomData.wT&&(J.kernelCustomData.wT=z);let D=[Q[0],z];G&&D.push(Q[2]);let S=H?U*E:R,w=H?R:U*E,k=L*B*V;J.compute(kO(D,X,W,S,w,k,G,P,Y),{inputs:D})},EM=(J,Q)=>{let X=Q.format==="NHWC",Y=[J.inputs[0].reshape(X?[J.inputs[0].dims[0],1,J.inputs[0].dims[1],J.inputs[0].dims[2]]:[J.inputs[0].dims[0],J.inputs[0].dims[1],1,J.inputs[0].dims[2]]),J.inputs[1].reshape([J.inputs[1].dims[0],J.inputs[1].dims[1],1,J.inputs[1].dims[2]])];J.inputs.length===3&&Y.push(J.inputs[2]);let H=[0,Q.pads[0],0,Q.pads[1]],W=[1].concat(Q.strides),G=[1].concat(Q.dilations),j=[1].concat(Q.kernelShape),N=t5({...Q,pads:H,strides:W,dilations:G,kernelShape:j},Y);e3(J,Y,N,(V)=>X?[V[0],V[2],V[3]]:[V[0],V[1],V[3]])},DM=(J,Q,X)=>{let Y=X.format==="NHWC"?"channelsLast":"channelsFirst",H=t5(X,Q),W=X.autoPad==="NOTSET"?X.pads:X.autoPad,G=CO(Q[0].dims,Q[1].dims,X.strides,X.dilations,W,!1,Y);J.compute(IO(Q,H,G.outShape,[G.filterDepth,G.filterHeight,G.filterWidth],[G.padInfo.front,G.padInfo.top,G.padInfo.left],Y))},hY=(J,Q)=>{if(RM(J.inputs,Q),J.inputs[0].dims.length===3)EM(J,Q);else if(J.inputs[0].dims.length===5)DM(J,J.inputs,Q);else{let X=t5(Q,J.inputs);e3(J,J.inputs,X)}}}),pA=Q0(()=>{z0(),h6(),w0(),I0(),vO=(J,Q,X)=>{let Y=J.length>2,H=Q.outputShape,W=Q.format==="NHWC",G=Q.group,j=J[1].dims,N=j[2]/G,V=j[3],L=W?e0(N):1,B=W?e0(V):1,U=W?V===1?L:B:1,E=u.size(H)/B,R=[Math.ceil(E/64),1,1];f0("verbose",()=>`[conv2d_backprop_webgpu] dispatch = ${R}`);let A=["rank","rank"],P=[Q.strides[0],Q.strides[1]],z=[Q.kernelShape[W?1:2],Q.kernelShape[W?2:3]],D=[Q.dilations[0],Q.dilations[1]],S=[z[0]+(Q.dilations[0]<=1?0:(Q.kernelShape[W?1:2]-1)*(Q.dilations[0]-1)),z[1]+(Q.dilations[1]<=1?0:(Q.kernelShape[W?2:3]-1)*(Q.dilations[1]-1))],w=[S[0]-1-Math.floor((Q.pads[0]+Q.pads[2])/2),S[1]-1-Math.floor((Q.pads[1]+Q.pads[3])/2)],k=[{type:12,data:E},{type:12,data:P},{type:12,data:z},{type:12,data:D},{type:12,data:S},{type:6,data:w},{type:12,data:N},{type:12,data:V},...R0(J[0].dims,J[1].dims)];Y&&(k.push(...R0(J[2].dims)),A.push("rank")),k.push(...R0(H));let I=(C)=>{let T=[{name:"output_size",type:"u32"},{name:"strides",type:"u32",length:P.length},{name:"filter_dims",type:"u32",length:z.length},{name:"dilations",type:"u32",length:z.length},{name:"effective_filter_dims",type:"u32",length:S.length},{name:"pads",type:"i32",length:w.length},{name:"input_channels_per_group",type:"u32"},{name:"output_channels_per_group",type:"u32"}],g=K1(J[0].dataType),m=W?1:2,l=W?2:3,t=W?3:1,h=i("W",J[1].dataType,J[1].dims.length,U),W0=i("Dy",J[0].dataType,J[0].dims.length,L),j0=[W0,h];Y&&j0.push(i("bias",J[2].dataType,[H[t]].length,B));let o=B0("result",J[0].dataType,H.length,B),G0=()=>{let s="";if(L===1)s+=`
        let w_offset = ${h.indicesToOffset(`${h.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel, wOutChannel)`)};
        let wValue = ${h.getByOffset(`w_offset / ${U}`)};
        dotProd = dotProd + xValue * wValue;`;else if(V===1)s+=`
          let wValue = ${h.getByOffset(`${h.indicesToOffset(`${h.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel, wOutChannel)`)} / ${U}`)};
          dotProd = dotProd + dot(xValue, wValue);`;else for(let N0=0;N0<L;N0++)s+=`
            let wValue${N0} = ${h.getByOffset(`${h.indicesToOffset(`${h.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel + ${N0}, wOutChannel)`)} / ${U}`)};
            dotProd = dotProd + xValue[${N0}] * wValue${N0};`;return s},F0=`
            let outputIndices = ${o.offsetToIndices(`global_idx * ${B}`)};
            let batch = ${o.indicesGet("outputIndices",0)};
            let d1 = ${o.indicesGet("outputIndices",t)};
            let r = ${o.indicesGet("outputIndices",m)};
            let c = ${o.indicesGet("outputIndices",l)};
            let dyCorner = vec2<i32>(i32(r), i32(c)) - uniforms.pads;
            let dyRCorner = dyCorner.x;
            let dyCCorner = dyCorner.y;
            let groupId = d1 / uniforms.output_channels_per_group;
            let wOutChannel = d1 - groupId * uniforms.output_channels_per_group;
            // Convolve dy(?, ?, d2) with w(:, :, d1, d2) to compute dx(xR, xC, d1).
            // ? = to be determined. : = across all values in that axis.
            var dotProd = ${o.type.value}(0.0);
            var wR: u32 = 0;
            if (uniforms.dilations.x == 1) {
              // Minimum wR >= 0 that satisfies (dyRCorner + wR) % (uniforms.strides.x) == 0
              wR = u32(((dyRCorner + i32(uniforms.strides.x) - 1) / i32(uniforms.strides.x)) * i32(uniforms.strides.x) - dyRCorner);
            }
            for (; wR < uniforms.effective_filter_dims.x; wR = wR + 1) {
              if (wR % uniforms.dilations.x != 0) {
                continue;
              }
              let dyR = (${g}(dyRCorner) + ${g}(wR)) / ${g}(uniforms.strides[0]);
              let wRPerm = uniforms.filter_dims.x - 1 - wR / uniforms.dilations.x;
              if (dyR < 0.0 || dyR >= ${g}(uniforms.Dy_shape[${m}]) || fract(dyR) > 0.0 ||
                  wRPerm < 0) {
                continue;
              }
              let idyR: u32 = u32(dyR);
              var wC: u32 = 0;
              if (uniforms.dilations.y == 1) {
                // Minimum wC >= 0 that satisfies (dyCCorner + wC) % (uniforms.strides.y) == 0
                wC = u32(((dyCCorner + i32(uniforms.strides.y) - 1) / i32(uniforms.strides.y)) * i32(uniforms.strides.y) - dyCCorner);
              }

              for (; wC < uniforms.effective_filter_dims.y; wC = wC + 1) {
                if (wC % uniforms.dilations.y != 0) {
                  continue;
                }
                let dyC = (${g}(dyCCorner) + ${g}(wC)) / ${g}(uniforms.strides.y);
                let wCPerm = uniforms.filter_dims.y - 1 - wC / uniforms.dilations.y;
                if (dyC < 0.0 || dyC >= ${g}(uniforms.Dy_shape[${l}]) ||
                    fract(dyC) > 0.0 || wCPerm < 0) {
                  continue;
                }
                let idyC: u32 = u32(dyC);
                var inputChannel = groupId * uniforms.input_channels_per_group;
                for (var d2: u32 = 0; d2 < uniforms.input_channels_per_group; d2 = d2 + ${L}) {
                  let xValue = ${W?W0.getByOffset(`${W0.indicesToOffset(`${W0.type.indices}(batch, idyR, idyC, inputChannel)`)} / ${L}`):W0.get("batch","inputChannel","idyR","idyC")};
                  ${G0()}
                  inputChannel = inputChannel + ${L};
                }
                wC = wC + uniforms.strides.y - 1;
              }
              wR = wR + uniforms.strides[0] - 1;
            }
            let value = dotProd${Y?` + bias[d1 / ${B}]`:""};
            ${o.setByOffset("global_idx","value")};
          `;return`
    ${C.registerUniforms(T).declareVariables(...j0,o)}
      ${C.mainStart()}
      ${C.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")};
    ${F0}}`};return{name:"ConvTranspose2D",shaderCache:{hint:`${Q.cacheKey};${L}${U}${B}${V===1}`,inputDependencies:A},getRunData:()=>({dispatchGroup:{x:R[0],y:R[1],z:R[2]},outputs:[{dims:X?X(H):H,dataType:J[0].dataType}],programUniforms:k}),getShaderSource:I}}}),cA=Q0(()=>{pA(),o8(),n6(),AM=(J,Q,X,Y,H,W)=>(J-1)*Q+X+(Y-1)*H+1-W,zM=(J,Q,X,Y,H)=>{let W=Math.floor(J/2);Q==="SAME_UPPER"?(X[Y]=W,X[H]=J-W):Q==="SAME_LOWER"&&(X[Y]=J-W,X[H]=W)},$M=(J,Q,X,Y,H,W,G,j,N,V)=>{let L=J.length-2,B=V.length===0;N.length<L&&N.push(...Array(L-N.length).fill(0));let U=J[0],E=Q[j?3:1]*H;for(let R=0,A=J.length-L-(j?1:0);R<L;++R,++A){let P=J[A],z=B?P*G[R]:V[R],D=AM(P,G[R],W[R],Q[A],X[R],z);zM(D,Y,W,R,R+L),B&&V.push(G[R]*(P-1)+N[R]+(Q[A]-1)*X[R]+1-W[R]-W[R+L])}V.splice(0,0,U),V.splice(j?3:1,0,E)},JY=(J,Q)=>{let X=J.kernelShape.slice();if(J.kernelShape.length===0||J.kernelShape.reduce((B,U)=>B*U,1)===0){X.length=0;for(let B=2;B<Q[1].dims.length;++B)X.push(Q[1].dims[B])}let Y=J.format==="NHWC";X.splice(0,0,Q[1].dims[0]),X.splice(Y?3:1,0,Q[1].dims[1]);let H=J.pads.slice(),W=J.outputShape.slice(),G=J.outputPadding.slice(),j=Q[0].dims,N=J.dilations.slice();if(N.reduce((B,U)=>B+U,0)===0){let B=Q[0].dims.length-2;N=Array(B).fill(1)}let V=J.strides.slice();if(V.reduce((B,U)=>B+U,0)===0){let B=Q[0].dims.length-2;V=Array(B).fill(1)}$M(j,X,N,J.autoPad,J.group,H,V,Y,G,W);let L=Object.assign({},J);return Object.assign(L,{kernelShape:X,pads:H,outputPadding:G,outputShape:W,dilations:N,strides:V}),L},TO=(J)=>{let Q=qH(J),X=J.format,Y=["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][typeof J.autoPad>"u"?0:J.autoPad],H=J.dilations,W=J.group,G=J.kernelShape,j=J.pads,N=J.strides,V=J.wIsConst(),L=J.outputPadding,B=J.outputShape;return{autoPad:Y,format:X,dilations:H,group:W,kernelShape:G,outputPadding:L,outputShape:B,pads:j,strides:N,wIsConst:V,...Q,cacheKey:`${J.format};${Q.activation};`}},PM=(J,Q)=>{if(!J||J.length!==2&&J.length!==3)throw Error("Conv requires 2 or 3 inputs");if(J[0].dims.length!==4&&J[0].dims.length!==3)throw Error("currently only support 2-dimensional conv");if(J[0].dims.length!==J[1].dims.length)throw Error("filter does not have same dimension as input");let X=J[0].dims[Q.format==="NHWC"?J[0].dims.length-1:1],Y=J[1].dims[0];if(X!==Y)throw Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");let H=J[1].dims[1]*Q.group;if(J.length===3&&(J[2].dims.length!==1||J[2].dims[0]!==H))throw Error("invalid bias");let W=J[0].dims.length-2;if(Q.dilations.reduce((G,j)=>G+j,0)>0&&Q.dilations.length!==W)throw Error(`dilations should be ${W}D`);if(Q.strides.reduce((G,j)=>G+j,0)>0&&Q.strides.length!==W)throw Error(`strides should be ${W}D`);if(Q.pads.reduce((G,j)=>G+j,0)>0&&Q.pads.length!==W*2)throw Error(`pads should be ${W*2}D`);if(Q.outputPadding.length!==W&&Q.outputPadding.length!==0)throw Error(`output_padding should be ${W}D`);if(Q.kernelShape.reduce((G,j)=>G+j,0)>0&&Q.kernelShape.length!==0&&Q.kernelShape.length!==J[1].dims.length-2)throw Error("invalid kernel shape");if(Q.outputShape.length!==0&&Q.outputShape.length!==J[0].dims.length-2)throw Error("invalid output shape")},QY=(J,Q,X,Y)=>{let H=J.kernelCustomData.wT??J.compute(y1(Q[1],[2,3,0,1]),{inputs:[1],outputs:[X.wIsConst?-2:-1]})[0];X.wIsConst&&!J.kernelCustomData.wT&&(J.kernelCustomData.wT=H);let W=[Q[0],H];Q.length===3&&W.push(Q[2]),J.compute(vO(W,X,Y),{inputs:W})},SM=(J,Q)=>{let X=Q.format==="NHWC",Y=[J.inputs[0].reshape(X?[J.inputs[0].dims[0],1,J.inputs[0].dims[1],J.inputs[0].dims[2]]:[J.inputs[0].dims[0],J.inputs[0].dims[1],1,J.inputs[0].dims[2]]),J.inputs[1].reshape([J.inputs[1].dims[0],J.inputs[1].dims[1],1,J.inputs[1].dims[2]])];J.inputs.length===3&&Y.push(J.inputs[2]);let H=Q.kernelShape;(H.length===0||H[0]===0)&&(H=[J.inputs[1].dims[2]]);let W=Q.dilations;(W.length===0||W[0]===0)&&(W=[1]);let G=Q.strides;(G.length===0||G[0]===0)&&(G=[1]);let j=Q.pads;j.length===0&&(j=[0,0]),j=[0,j[0],0,j[1]],G=[1].concat(G),W=[1].concat(W),H=[1].concat(H);let N=Q.outputPadding;N=[0].concat(N);let V=JY({...Q,pads:j,strides:G,dilations:W,kernelShape:H,outputPadding:N},Y);QY(J,Y,V,(L)=>X?[L[0],L[2],L[3]]:[L[0],L[1],L[3]])},xO=(J,Q)=>{if(PM(J.inputs,Q),J.inputs[0].dims.length===3)SM(J,Q);else{let X=JY(Q,J.inputs);QY(J,J.inputs,X)}}}),dA=Q0(()=>{z0(),w0(),Q1(),I0(),ZM=(J,Q,X,Y)=>{let H=u.size(Q),W=Q.length,G=i("input",J,W),j=B0("output",J,W),N=X.dataType===6?X.getInt32Array()[0]:Number(X.getBigInt64Array()[0]),V=u.normalizeAxis(N,W),L=(B)=>{let U=` i32(${G.indicesGet("inputIndices","uniforms.axis")}) `,E=U0("uniforms.input_shape","uniforms.axis",W),R=Y.reverse?U+(Y.exclusive?" + 1":""):"0",A=Y.reverse?E:U+(Y.exclusive?"":" + 1");return`
                ${B.registerUniform("outputSize","u32").registerUniform("axis","u32").declareVariables(G,j)}
                ${B.mainStart()}
                  ${B.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
                  var inputIndices = ${j.offsetToIndices("global_idx")};
                  var sum = ${j.type.value}(0);
                  let first : i32 = ${R};
                  let last : i32 = ${A};
                  for (var i : i32 = first; i < last; i++) {
                    ${G.indicesSet("inputIndices","uniforms.axis","u32(i)")};
                    sum = sum + ${G.getByIndices("inputIndices")};
                  }
                  ${j.setByOffset("global_idx","sum")};
                }`};return{name:"CumSum",shaderCache:{hint:Y.cacheKey,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:Q,dataType:J}],dispatchGroup:{x:Math.ceil(H/64)},programUniforms:[{type:12,data:H},{type:12,data:V},...R0(Q,Q)]}),getShaderSource:L}},fO=(J,Q)=>{let X=J.inputs[0].dims,Y=J.inputs[0].dataType,H=J.inputs[1];J.compute(ZM(Y,X,H,Q),{inputs:[0]})},hO=(J)=>{let Q=J.exclusive===1,X=J.reverse===1;return d0({exclusive:Q,reverse:X})}}),uA=Q0(()=>{z0(),w0(),Q1(),I0(),wM=(J)=>{if(!J||J.length!==1)throw Error("DepthToSpace requires 1 input.");if(J[0].dims.length!==4)throw Error("DepthToSpace requires 4D input.")},kM=(J,Q,X,Y)=>{let H=[];H.push(`fn perm(i: ${Y.type.indices}) -> ${X.type.indices} {
    var a: ${X.type.indices};`);for(let W=0;W<Q;++W)H.push(X.indicesSet("a",J[W],`i[${W}]`));return H.push("return a;}"),H.join(`
`)},CM=(J,Q)=>{let X,Y,H,W,G,j,N=Q.format==="NHWC",V=Q.blocksize,L=Q.mode==="DCR";N?([X,Y,H,W]=J.dims,G=L?[X,Y,H,V,V,W/V**2]:[X,Y,H,W/V**2,V,V],j=L?[0,1,3,2,4,5]:[0,1,4,2,5,3]):([X,Y,H,W]=[J.dims[0],J.dims[2],J.dims[3],J.dims[1]],G=L?[X,V,V,W/V**2,Y,H]:[X,W/V**2,V,V,Y,H],j=L?[0,3,4,1,5,2]:[0,1,4,2,5,3]);let B=J.reshape(G),U=B.dims.length,E=J.dataType,R=i("a",E,U),A=B0("output",E,U),P=(z)=>`
  ${z.registerUniform("output_size","u32").declareVariables(R,A)}

  ${kM(j,U,R,A)}

  ${z.mainStart()}
    ${z.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${A.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${A.setByOffset("global_idx",R.getByIndices("aIndices"))}
  }`;return{name:"DepthToSpace",shaderCache:{hint:`${J.dims};${Q.blocksize};${Q.mode}`,inputDependencies:["rank"]},getRunData:(z)=>{let D=N?[X,Y*V,H*V,W/V**2]:[X,W/V**2,Y*V,H*V],S=u.size(D),w=B.dims,k=u.sortBasedOnPerm(w,j);return{outputs:[{dims:D,dataType:z[0].dataType}],dispatchGroup:{x:Math.ceil(S/64)},programUniforms:[{type:12,data:S},...R0(w,k)]}},getShaderSource:P}},yO=(J,Q)=>{wM(J.inputs),J.compute(CM(J.inputs[0],Q))},gO=(J)=>d0({blocksize:J.blocksize,mode:J.mode,format:J.format})}),oA=Q0(()=>{z0(),w0(),Q1(),I0(),e5="[a-zA-Z]|\\.\\.\\.",p2="("+e5+")+",XY="^"+p2+"$",IM="("+p2+",)*"+p2,_M="^"+IM+"$",bM=class{constructor(J=-1){this.symbolToIndices=new Map,this.inputIndex=J}addSymbol(J,Q){let X=this.symbolToIndices.get(J);X===void 0?X=[Q]:X.push(Q),this.symbolToIndices.set(J,X)}},vM=class{constructor(J,Q){this.equation=Q,this.hasEllipsis=!1,this.symbolToInfo=new Map,this.lhs=[],this.outputDims=[];let[X,Y]=Q.includes("->")?Q.split("->",2):[Q,""];if(!X.match(RegExp(_M)))throw Error("Invalid LHS term");if(X.split(",").forEach((H,W)=>{let G=J[W].dims.slice();if(!H.match(RegExp(XY)))throw Error("Invalid LHS term");let j=this.processTerm(H,!0,G,W);this.lhs.push(j)}),Y==="")Y+=[...this.symbolToInfo.entries()].filter(([H,W])=>W.count===1||H==="...").map(([H])=>H).join("");else if(!Y.match(RegExp(p2)))throw Error("Invalid RHS");Y.match(RegExp(e5,"g"))?.forEach((H)=>{if(H==="...")this.outputDims=this.outputDims.concat(this.ellipsisDims);else{let W=this.symbolToInfo.get(H);if(W===void 0)throw Error("Invalid RHS symbol");this.outputDims.push(W.dimValue)}}),this.rhs=this.processTerm(Y,!1,this.outputDims)}addSymbol(J,Q,X){let Y=this.symbolToInfo.get(J);if(Y!==void 0){if(Y.dimValue!==Q&&Y.count!==1)throw Error("Dimension mismatch");Y.count++,Y.inputIndices.push(X)}else Y={count:1,dimValue:Q,inputIndices:[X]};this.symbolToInfo.set(J,Y)}processTerm(J,Q,X,Y=-1){let H=X.length,W=!1,G=[],j=0;if(!J.match(RegExp(XY))&&!Q&&J!=="")throw Error("Invalid LHS term");let N=J.match(RegExp(e5,"g")),V=new bM(Y);return N?.forEach((L,B)=>{if(L==="..."){if(W)throw Error("Only one ellipsis is allowed per input term");W=!0;let U=H-N.length+1;if(U<0)throw Error("Ellipsis out of bounds");if(G=X.slice(j,j+U),this.hasEllipsis){if(this.ellipsisDims.length!==G.length||this.ellipsisDims.toString()!==G.toString())throw Error("Ellipsis dimensions mismatch")}else if(Q)this.hasEllipsis=!0,this.ellipsisDims=G;else throw Error("Ellipsis must be specified in the LHS");for(let E=0;E<G.length;E++){let R=String.fromCharCode(48+E);V.addSymbol(R,B+E),this.addSymbol(R,X[j++],Y)}}else V.addSymbol(L,B+(this.hasEllipsis?this.ellipsisDims.length-1:0)),this.addSymbol(L,X[j++],Y)}),V}},YY=(J)=>J+"_max",TM=(J,Q,X,Y)=>{let H=J.map((V)=>V.length).map((V,L)=>i(`input${L}`,Q,V)),W=u.size(Y),G=B0("output",Q,Y.length),j=[...X.symbolToInfo.keys()].filter((V)=>!X.rhs.symbolToIndices.has(V)),N=(V)=>{let L=[],B="var prod = 1.0;",U="var sum = 0.0;",E="sum += prod;",R=[],A=[],P=[],z=[],D=X.symbolToInfo.size===X.rhs.symbolToIndices.size;X.symbolToInfo.forEach((w,k)=>{if(X.rhs.symbolToIndices.has(k)){let I=X.rhs.symbolToIndices.get(k)?.[0];I!==void 0&&X.lhs.forEach((C,T)=>{if(w.inputIndices.includes(T)){let g=C.symbolToIndices.get(k);if(g===void 0)throw Error("Invalid symbol error");g.forEach((m)=>{L.push(`${H[T].indicesSet(`input${T}Indices`,m,G.indicesGet("outputIndices",I))}`)})}})}else X.lhs.forEach((I,C)=>{if(w.inputIndices.includes(C)){let T=I.symbolToIndices.get(k);if(T===void 0)throw Error("Invalid symbol error");T.forEach((g)=>{R.push(`${H[C].indicesSet(`input${C}Indices`,g,`${k}`)}`)}),z.push(`prod *= ${H[C].getByIndices(`input${C}Indices`)};`)}}),A.push(`for(var ${k}: u32 = 0; ${k} < uniforms.${YY(k)}; ${k}++) {`),P.push("}")});let S=D?[...L,`let sum = ${H.map((w,k)=>w.getByIndices(`input${k}Indices`)).join(" * ")};`]:[...L,U,...A,...R,B,...z,E,...P];return`
            ${V.registerUniforms(j.map((w)=>({name:`${YY(w)}`,type:"u32"}))).registerUniform("outputSize","u32").declareVariables(...H,G)}

            ${V.mainStart()}
            ${V.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
            var outputIndices = ${G.offsetToIndices("global_idx")};
            ${H.map((w,k)=>`var input${k}Indices: ${H[k].type.indices};`).join(`
`)}
            ${S.join(`
`)};
            ${G.setByOffset("global_idx","sum")};
          }`};return{name:"Einsum",shaderCache:{hint:X.equation,inputDependencies:J.map(()=>"rank")},getRunData:()=>{let V=j.filter((B)=>X.symbolToInfo.has(B)).map((B)=>({type:12,data:X.symbolToInfo.get(B)?.dimValue||0}));V.push({type:12,data:W});let L=J.map((B,U)=>[...R0(B)]).reduce((B,U)=>B.concat(U),V);return L.push(...R0(Y)),{outputs:[{dims:Y,dataType:Q}],dispatchGroup:{x:Math.ceil(W/64)},programUniforms:L}},getShaderSource:N}},lO=(J,Q)=>{let X=new vM(J.inputs,Q.equation),Y=X.outputDims,H=J.inputs.map((W,G)=>W.dims);J.compute(TM(H,J.inputs[0].dataType,X,Y))},mO=(J)=>{let Q=J.equation.replace(/\s+/g,"");return d0({equation:Q})}}),sA=Q0(()=>{z0(),w0(),I0(),xM=(J)=>{if(!J||J.length!==2)throw Error("Expand requires 2 input.");let Q=J[0].dims,X=Array.from(J[1].getBigInt64Array(),Number),Y=X.length<Q.length?0:X.length-Q.length,H=Q.length<X.length?0:Q.length-X.length;for(;Y<X.length&&H<Q.length;++Y,++H)if(X[Y]!==Q[H]&&X[Y]!==1&&Q[H]!==1)throw Error("Expand requires shape to be broadcastable to input")},HY=(J,Q)=>{let X=J.length-Q.length,Y=[];for(let H=0;H<X;++H)Y.push(J[H]);for(let H=0;H<Q.length;++H)Y.push(Q[H]===1?J[H+X]:Q[H]);return Y},fM=(J,Q)=>J.length>Q.length?HY(J,Q):HY(Q,J),hM=(J)=>{let Q=J[0].dims,X=Array.from(J[1].getBigInt64Array(),Number),Y=fM(Q,X),H=J[0].dataType,W=H===9||u.size(Q)===1,G=H===9||Q.length>0&&Q[Q.length-1]%4===0?4:1,j=W||Y.length>0&&Y[Y.length-1]%4===0?4:1,N=Math.ceil(u.size(Y)/j),V=(B)=>{let U=i("input",H,Q.length,G),E=B0("output",H,Y.length,j),R;if(H===9){let A=(P,z,D="")=>`
          let outputIndices${z} = ${E.offsetToIndices(`outputOffset + ${z}u`)};
          let offset${z} = ${U.broadcastedIndicesToOffset(`outputIndices${z}`,E)};
          let index${z} = offset${z} / 4u;
          let component${z} = offset${z} % 4u;
          ${P}[${z}] = ${D}(${U.getByOffset(`index${z}`)}[component${z}]);
        `;R=`
        let outputOffset = global_idx * ${j};
        var data = vec4<u32>(0);
        ${A("data",0,"u32")}
        ${A("data",1,"u32")}
        ${A("data",2,"u32")}
        ${A("data",3,"u32")}
        ${E.setByOffset("global_idx","data")}
      }`}else R=`
        let outputIndices = ${E.offsetToIndices(`global_idx * ${j}`)};
        let inputOffset = ${U.broadcastedIndicesToOffset("outputIndices",E)};
        let data = ${E.type.value}(${U.getByOffset(`inputOffset / ${G}`)});
        ${E.setByOffset("global_idx","data")}
      }`;return`
    ${B.registerUniform("vec_size","u32").declareVariables(U,E)}
    ${B.mainStart()}
    ${B.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
    ${R}`},L=[{type:12,data:N},...R0(Q,Y)];return{name:"Expand",shaderCache:{hint:`${Y.length};${G}${j}`,inputDependencies:["rank"]},getShaderSource:V,getRunData:()=>({outputs:[{dims:Y,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(N/64)},programUniforms:L})}},pO=(J)=>{xM(J.inputs),J.compute(hM(J.inputs),{inputs:[0]})}}),aA=Q0(()=>{z0(),w0(),I0(),HH(),yM=(J)=>{let Q=J[0].dataType,X=u.size(J[0].dims),Y=u.size(J[1].dims),H=Y%4===0,W=(G)=>{let j=i("x",Q,[1],4),N=i("bias",Q,[1],4),V=B0("y",Q,[1],4),L=[{name:"output_vec_size",type:"u32"},{name:"bias_size",type:"u32"}],B=(E)=>`
      let bias${E}_offset: u32 = (global_idx * 4 + ${E}) % uniforms.bias_size;
      let bias${E} = ${N.getByOffset(`bias${E}_offset / 4`)}[bias${E}_offset % 4];`,U=H?`
      let bias = ${N.getByOffset("global_idx % (uniforms.bias_size / 4)")};`:`${B(0)}${B(1)}${B(2)}${B(3)}
      let bias = ${j.type.value}(bias0, bias1, bias2, bias3);`;return`${G.registerUniforms(L).declareVariables(j,N,V)}

    ${bY(P1(Q))}

    ${G.mainStart(W7)}
      ${G.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_vec_size")}

      let x = ${j.getByOffset("global_idx")};
      ${U}
      let x_in = x + bias;
      ${V.setByOffset("global_idx",vY("x_in"))}
    }`};return{name:"FastGeluWithBias",shaderCache:{hint:`${H}`,inputDependencies:["type","type"]},getShaderSource:W,getRunData:(G)=>({outputs:[{dims:G[0].dims,dataType:G[0].dataType}],programUniforms:[{type:12,data:Math.ceil(X/4)},{type:12,data:Y}],dispatchGroup:{x:Math.ceil(X/W7/4)}})}},cO=(J)=>{J.inputs.length<2||u.size(J.inputs[1].dims)===0?FO(J):J.compute(yM(J.inputs))}}),iA=Q0(()=>{z0(),w0(),Q1(),I0(),gM=(J)=>{if(!J||J.length!==2)throw Error("Gather requires 2 inputs.")},lM=(J,Q)=>{let X=J[0].dims,Y=J[1].dims,H=X.length,W=u.normalizeAxis(Q.axis,H),G=X.slice(0);G.splice(W,1,...Y);let j=X[W],N=J[0].dataType===9?4:1,V=Math.ceil(u.size(G)/N),L=[{type:12,data:V},{type:6,data:j},{type:12,data:W},...R0(J[0].dims,J[1].dims,G)],B=(U)=>{let E=i("data",J[0].dataType,J[0].dims.length,N),R=i("inputIndices",J[1].dataType,J[1].dims.length),A=B0("output",J[0].dataType,G.length,N),P=(D)=>{let S=Y.length,w=`var indicesIndices${D}  = ${R.type.indices}(0);`;for(let k=0;k<S;k++)w+=`${S>1?`indicesIndices${D}[${k}]`:`indicesIndices${D}`} = ${G.length>1?`outputIndices${D}[uniforms.axis + ${k}]`:`outputIndices${D}`};`;w+=`
          var idx${D} = ${R.getByIndices(`indicesIndices${D}`)};
          if (idx${D} < 0) {
            idx${D} = idx${D} + uniforms.axisDimLimit;
          }
          var dataIndices${D} : ${E.type.indices};
        `;for(let k=0,I=0;k<H;k++)k===W?(w+=`${H>1?`dataIndices${D}[${k}]`:`dataIndices${D}`} = u32(idx${D});`,I+=S):(w+=`${H>1?`dataIndices${D}[${k}]`:`dataIndices${D}`} = ${G.length>1?`outputIndices${D}[${I}]`:`outputIndices${D}`};`,I++);return w},z;if(J[0].dataType===9){let D=(S,w,k="")=>`
          let outputIndices${w} = ${A.offsetToIndices(`outputOffset + ${w}u`)};
          ${P(w)};
          let offset${w} = ${E.indicesToOffset(`dataIndices${w}`)};
          let index${w} = offset${w} / 4u;
          let component${w} = offset${w} % 4u;
          ${S}[${w}] = ${k}(${E.getByOffset(`index${w}`)}[component${w}]);
        `;z=`
        let outputOffset = global_idx * ${N};
        var value = vec4<u32>(0);
        ${D("value",0,"u32")}
        ${D("value",1,"u32")}
        ${D("value",2,"u32")}
        ${D("value",3,"u32")}
        ${A.setByOffset("global_idx","value")}
      `}else z=`
      let outputIndices = ${A.offsetToIndices("global_idx")};
      ${P("")};
      let value = ${E.getByIndices("dataIndices")};
      ${A.setByOffset("global_idx","value")};
      `;return`
      ${U.registerUniform("outputSize","u32").registerUniform("axisDimLimit","i32").registerUniform("axis","u32").declareVariables(E,R,A)}
      ${U.mainStart()}
        ${U.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        ${z}
      }`};return{name:"Gather",shaderCache:{hint:Q.cacheKey,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:G,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(V/64)},programUniforms:L}),getShaderSource:B}},dO=(J)=>d0({axis:J.axis}),uO=(J,Q)=>{let X=J.inputs;gM(X),J.compute(lM(J.inputs,Q))}}),nA=Q0(()=>{z0(),w0(),I0(),mM=(J,Q,X,Y,H,W,G,j,N)=>{let V=[{type:12,data:W},{type:12,data:Y},{type:12,data:H},{type:12,data:X},{type:12,data:G},{type:12,data:j},{type:12,data:N}],L=[W];V.push(...R0(Q.dims,L));let B=(U)=>{let E=i("indices_data",Q.dataType,Q.dims.length),R=B0("input_slice_offsets_data",12,1,1),A=[E,R],P=[{name:"output_size",type:"u32"},{name:"batch_dims",type:"u32"},{name:"input_dims",type:"u32",length:H.length},{name:"sizes_from_slice_dims_data",type:"u32",length:X.length},{name:"num_slices_per_batch",type:"u32"},{name:"input_batch_stride",type:"u32"},{name:"num_slice_dims",type:"u32"}];return`
  ${U.registerUniforms(P).declareVariables(...A)}
  ${U.mainStart()}
    ${U.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let batch_idx = global_idx / uniforms.num_slices_per_batch;
    let base_offset = batch_idx * uniforms.input_batch_stride;

    let slice_indices_base_offset = global_idx * uniforms.num_slice_dims;
    var relative_slice_offset = 0;
    for (var dim_idx = 0u; dim_idx < uniforms.num_slice_dims; dim_idx ++) {
      var index = i32(indices_data[dim_idx + slice_indices_base_offset].x);
      let input_dim_idx = uniforms.batch_dims + dim_idx;
      if (index < 0) {
        ${H.length===1?"index += i32(uniforms.input_dims);":"index += i32(uniforms.input_dims[input_dim_idx]);"}
      }
      ${X.length===1?"relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data);":"relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data[dim_idx]);"}
    }

    input_slice_offsets_data[global_idx] =  base_offset + u32(relative_slice_offset);
  }`};return J.compute({name:"computeSliceOffsets",shaderCache:{hint:`${H.length}_${X.length}`,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:L,dataType:J.inputs[1].dataType}],dispatchGroup:{x:Math.ceil(W/64)},programUniforms:V}),getShaderSource:B},{inputs:[Q],outputs:[-1]})[0]},oO=(J,Q)=>{let X=J.inputs,Y=X[0].dims,H=X[0].dataType,W=X[1].dims,G=W[W.length-1],j=u.sizeToDimension(W,W.length-1),N=u.sizeFromDimension(Y,Q.batchDims+G),V=u.sizeToDimension(Y,Q.batchDims),L=u.sizeFromDimension(Y,Q.batchDims),B=j/V,U=Array(G),E=N;for(let w=0;w<G;++w)U[G-1-w]=E,E*=Y[Q.batchDims+G-1-w];let R=mM(J,X[1],U,Q.batchDims,Y,j,B,L,G),A=Q.batchDims+G;if(A>Y.length)throw Error("last dimension of indices must not be larger than rank of input tensor");let P=W.slice(0,-1).concat(Y.slice(A)),z=u.size(P),D=[{type:12,data:z},{type:12,data:N},...R0(X[0].dims,R.dims,P)],S=(w)=>{let k=i("data",X[0].dataType,X[0].dims.length),I=i("slice_offsets",12,R.dims.length),C=B0("output",X[0].dataType,P.length);return`
          ${w.registerUniform("output_size","u32").registerUniform("slice_size","u32").declareVariables(k,I,C)}
            ${w.mainStart()}
            ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let slice_offset = slice_offsets[global_idx / uniforms.slice_size];
          output[global_idx] = data[u32(slice_offset) + global_idx % uniforms.slice_size];
        }`};J.compute({name:"GatherND",shaderCache:{hint:Q.cacheKey,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:P,dataType:H}],dispatchGroup:{x:Math.ceil(z/64)},programUniforms:D}),getShaderSource:S},{inputs:[X[0],R]})},sO=(J)=>({batchDims:J.batch_dims,cacheKey:""})}),rA=Q0(()=>{z0(),w0(),Q1(),I0(),pM=(J,Q)=>{if(J.length<3||J.length>4)throw Error("GatherBlockQuantized requires 3 or 4 inputs.");let X=u.normalizeAxis(Q.quantizeAxis,J[0].dims.length),Y=Q.blockSize,H=J[0],W=J[2],G=J.length===4?J[3]:void 0;if(W.dims.length!==H.dims.length||!H.dims.map((j,N)=>N===X?Math.ceil(j/Y)===W.dims[N]:j===W.dims[N]).reduce((j,N)=>j&&N,!0))throw Error("Scales must have the same rank as the input tensor and the dims should match except on gatherAxis.");if(G){if(G.dataType!==H.dataType)throw Error("Zero point must have the same data type as the input tensor.");if(G.dims.length!==W.dims.length||!G.dims.map((j,N)=>j===W.dims[N]).reduce((j,N)=>j&&N,!0))throw Error("Zero point must have the same rank as the input tensor and the dims should match except on quantizeAxis.")}},cM=(J,Q)=>{let X=J[0].dims,Y=J[1].dims,H=X.length,W=u.normalizeAxis(Q.gatherAxis,H),G=u.normalizeAxis(Q.quantizeAxis,H),j=X.slice(0);j.splice(W,1,...Y);let N=u.size(j),V=J[2].dataType,L=J[0].dataType===22,B=[{type:12,data:N},{type:12,data:G},{type:12,data:W},{type:12,data:Q.blockSize},...R0(...J.map((E,R)=>E.dims),j)],U=(E)=>{let R=i("data",J[0].dataType,J[0].dims.length),A=i("inputIndices",J[1].dataType,J[1].dims.length),P=i("scales",J[2].dataType,J[2].dims.length),z=J.length>3?i("zeroPoint",J[3].dataType,J[3].dims.length):void 0,D=B0("output",V,j.length),S=[R,A,P];z&&S.push(z);let w=[{name:"output_size",type:"u32"},{name:"quantize_axis",type:"u32"},{name:"gather_axis",type:"u32"},{name:"block_size",type:"u32"}];return`
        ${E.registerUniforms(w).declareVariables(...S,D)}
        ${E.mainStart()}
        let output_indices = ${D.offsetToIndices("global_idx")};
        var indices_indices = ${A.type.indices}(0);
        ${Y.length>1?`
          for (var i: u32 = 0; i < ${Y.length}; i++) {
            let index = ${D.indicesGet("output_indices","uniforms.gather_axis + i")};
            ${A.indicesSet("indices_indices","i","index")};
          }`:`indices_indices = ${D.indicesGet("output_indices","uniforms.gather_axis")};`};
        var data_indices = ${R.type.indices}(0);
        for (var i: u32 = 0; i < uniforms.gather_axis; i++) {
          let index = ${D.indicesGet("output_indices","i")};
          ${R.indicesSet("data_indices","i","index")};
        }
        var index_from_indices = ${A.getByIndices("indices_indices")};
        if (index_from_indices < 0) {
          index_from_indices += ${X[W]};
        }
        ${R.indicesSet("data_indices","uniforms.gather_axis","u32(index_from_indices)")};
        for (var i = uniforms.gather_axis + 1; i < ${j.length}; i++) {
          let index = ${D.indicesGet("output_indices",`i + ${Y.length} - 1`)};
          ${R.indicesSet("data_indices","i","index")};
        }
        let data_offset = ${R.indicesToOffset("data_indices")};
        let data_index = data_offset % 8;
        // Convert 4-bit packed data to 8-bit packed data.
        let packed_4bit_quantized_data = ${R.getByOffset("data_offset / 8")};
        let packed_8bit_quantized_data = (packed_4bit_quantized_data >> (4 * (data_index % 2))) & 0x0f0f0f0f;
        let quantized_data_vec = ${L?"unpack4xI8":"unpack4xU8"}(u32(packed_8bit_quantized_data));
        let quantized_data = quantized_data_vec[data_index / 2];
        var scale_indices = data_indices;
        let quantize_axis_index = ${P.indicesGet("data_indices","uniforms.quantize_axis")} / uniforms.block_size;
        ${P.indicesSet("scale_indices","uniforms.quantize_axis","quantize_axis_index")};
        var scale = ${P.getByIndices("scale_indices")};
        ${z?`
              let zero_point_indices = scale_indices;
              let zero_point_offset = ${z.indicesToOffset("zero_point_indices")};
              let zero_point_index = zero_point_offset % 8;
              let packed_4bit_zero_points = ${z.getByOffset("zero_point_offset / 8")};
              let packed_8bit_zero_points = (packed_4bit_zero_points >> (4 * (zero_point_index % 2))) & 0x0f0f0f0f;
              let zero_point_vec = ${L?"unpack4xI8":"unpack4xU8"}(u32(packed_8bit_zero_points));
              let zero_point = zero_point_vec[zero_point_index / 2];`:"var zero_point = 0"};
        let dequantized_data = ${P1(V)}(quantized_data - zero_point) * scale;
        ${D.setByOffset("global_idx","dequantized_data")};
    }`};return{name:"GatherBlockQuantized",shaderCache:{hint:`${Q.cacheKey};${J.filter((E,R)=>R!==1).map((E)=>E.dims.join("_")).join(";")}`,inputDependencies:Array.from({length:J.length},(E,R)=>"rank")},getRunData:()=>({outputs:[{dims:j,dataType:V}],dispatchGroup:{x:Math.ceil(N/64)},programUniforms:B}),getShaderSource:U}},aO=(J,Q)=>{let X=J.inputs;pM(X,Q),J.compute(cM(J.inputs,Q))},iO=(J)=>d0({blockSize:J.blockSize,gatherAxis:J.gatherAxis,quantizeAxis:J.quantizeAxis})}),tA=Q0(()=>{z0(),w0(),Q1(),I0(),dM=(J)=>{if(!J||J.length!==2)throw Error("GatherElements requires 2 inputs.");if(J[0].dims.length<1)throw Error("GatherElements requires that the data input be rank >= 1.");if(J[0].dims.length!==J[1].dims.length)throw Error(`GatherElements requires that the data input and
                     indices input tensors be of same rank.`)},uM=(J,Q)=>{let X=J[0].dims,Y=J[0].dataType,H=X.length,W=J[1].dims,G=J[1].dataType,j=u.normalizeAxis(Q.axis,H),N=X[j],V=W.slice(0),L=u.size(V),B=i("input",Y,H),U=i("indicesInput",G,W.length),E=B0("output",Y,V.length),R=[{type:12,data:L},{type:6,data:N},{type:12,data:j}];return R.push(...R0(X,W,V)),{name:"GatherElements",shaderCache:{inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:V,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(L/64)},programUniforms:R}),getShaderSource:(A)=>`
      ${A.registerUniform("outputSize","u32").registerUniform("axisDimLimit","i32").registerUniform("axis","u32").declareVariables(B,U,E)}
      ${A.mainStart()}
      ${A.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

      let outputIndices = ${E.offsetToIndices("global_idx")};

      var idx = ${U.getByOffset("global_idx")};
      if (idx < 0) {
        idx = idx + uniforms.axisDimLimit;
      }
      var inputIndices = ${B.type.indices}(outputIndices);
      ${B.indicesSet("inputIndices","uniforms.axis","u32(idx)")};
      let value = ${B.getByIndices("inputIndices")};

      ${E.setByOffset("global_idx","value")};
  }`}},nO=(J)=>d0({axis:J.axis}),rO=(J,Q)=>{let X=J.inputs;dM(X),J.compute(uM(J.inputs,Q))}}),eA=Q0(()=>{z0(),w0(),I0(),oM=(J)=>{if(!J)throw Error("Input is missing");if(J.length<2||J.length>3)throw Error("Invaid input number.");if(J.length===3&&J[2].dims.length>2)throw Error("Invalid input shape of C");if(J[0].dataType!==J[1].dataType||J.length===3&&J[0].dataType!==J[2].dataType)throw Error("Input types are mismatched")},sM=(J,Q)=>{let X=J[0].dims.slice(),Y=J[1].dims.slice(),[H,W,G]=JU.getShapeOfGemmResult(X,Q.transA,Y,Q.transB,J.length===3?J[2].dims:void 0),j=[H,W];if(!j)throw Error("Can't use gemm on the given tensors");let N=16,V=Math.ceil(W/N),L=Math.ceil(H/N),B=!0,U=u.size(j),E=[{type:12,data:B?V:U},{type:12,data:H},{type:12,data:W},{type:12,data:G},{type:1,data:Q.alpha},{type:1,data:Q.beta}],R=["type","type"];J.length===3&&(E.push(...R0(J[2].dims)),R.push("rank")),E.push(...R0(j));let A=(z)=>{let D="";Q.transA&&Q.transB?D="value += a[k * uniforms.M + m] * b[n * uniforms.K + k];":Q.transA&&!Q.transB?D="value += a[k * uniforms.M + m] * b[k * uniforms.N + n];":!Q.transA&&Q.transB?D="value += a[m * uniforms.K + k] * b[n * uniforms.K + k];":!Q.transA&&!Q.transB&&(D="value += a[m * uniforms.K + k] * b[k * uniforms.N + n];");let S=Q.alpha===1?"":"value *= uniforms.alpha;",w=i("a",J[0].dataType,J[0].dims),k=i("b",J[1].dataType,J[1].dims),I=w.type.value,C=null,T=[w,k];J.length===3&&(C=i("c",J[2].dataType,J[2].dims.length),T.push(C));let g=B0("output",J[0].dataType,j.length);T.push(g);let m=[{name:"output_size",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"},{name:"alpha",type:"f32"},{name:"beta",type:"f32"}];return`
  ${z.registerUniforms(m).declareVariables(...T)}

  ${z.mainStart()}
    ${z.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let m = global_idx / uniforms.N;
    let n = global_idx % uniforms.N;

    var value = ${I}(0);
    for (var k: u32 = 0u; k < uniforms.K; k++) {
      ${D}
    }

    ${S}
    ${C!=null?`let cOffset = ${C.broadcastedIndicesToOffset("vec2(m, n)",g)}; value += ${I}(uniforms.beta) * ${C.getByOffset("cOffset")};`:""}
    output[global_idx] = value;
  }`},P=(z)=>{let D=i("a",J[0].dataType,J[0].dims),S=i("b",J[1].dataType,J[1].dims),w=null,k=[D,S];J.length===3&&(w=i("c",J[2].dataType,J[2].dims.length),k.push(w));let I=B0("output",J[0].dataType,j.length);k.push(I);let C=[{name:"num_tile_n",type:"u32"},{name:"M",type:"u32"},{name:"N",type:"u32"},{name:"K",type:"u32"},{name:"alpha",type:"f32"},{name:"beta",type:"f32"}],T="",g="";Q.transA&&Q.transB?(g=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${D.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${S.type.value}(0);
      }
      `,T="value += tile_a[k][local_id.y] * tile_b[local_id.x][k];"):Q.transA&&!Q.transB?(g=`
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${D.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${S.type.value}(0);
      }
      `,T="value += tile_a[k][local_id.y] * tile_b[k][local_id.x];"):!Q.transA&&Q.transB?(g=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${D.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${S.type.value}(0);
      }
      `,T="value += tile_a[local_id.y][k] * tile_b[local_id.x][k];"):!Q.transA&&!Q.transB&&(g=`
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${D.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${S.type.value}(0);
      }
      `,T="value += tile_a[local_id.y][k] * tile_b[k][local_id.x];");let m=Q.alpha===1?"":"value *= uniforms.alpha;";return`
  ${z.registerUniforms(C).declareVariables(...k)}
  var<workgroup> tile_a: array<array<${D.type.storage}, ${N}>, ${N}>;
  var<workgroup> tile_b: array<array<${S.type.storage}, ${N}>, ${N}>;
  ${z.mainStart([N,N,1])}
    let tile_col_start = (workgroup_index % uniforms.num_tile_n) * ${N};
    let tile_row_start = (workgroup_index / uniforms.num_tile_n) * ${N};
    let num_tiles = (uniforms.K - 1) / ${N} + 1;
    var k_start = 0u;
    var value = ${I.type.value}(0);
    for (var t: u32 = 0u; t < num_tiles; t++) {
      ${g}
      k_start = k_start + ${N};
      workgroupBarrier();

      for (var k: u32 = 0u; k < ${N}; k++) {
        ${T}
      }
      workgroupBarrier();
    }

    ${m}
    let m = tile_row_start + local_id.y;
    let n = tile_col_start + local_id.x;
    ${w!=null?`let cOffset = ${w.broadcastedIndicesToOffset("vec2(m, n)",I)}; value += ${I.type.value}(uniforms.beta) * ${w.getByOffset("cOffset")};`:""}
    if (m < uniforms.M && n < uniforms.N) {
      output[m * uniforms.N + n] = value;
    }
  }`};return B?{name:"GemmShared",shaderCache:{hint:`${Q.cacheKey}`,inputDependencies:R},getRunData:()=>({outputs:[{dims:j,dataType:J[0].dataType}],dispatchGroup:{x:V*L},programUniforms:E}),getShaderSource:P}:{name:"Gemm",shaderCache:{hint:`${Q.cacheKey}`,inputDependencies:R},getRunData:()=>({outputs:[{dims:j,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(U/64)},programUniforms:E}),getShaderSource:A}},tO=(J)=>{let{transA:Q,transB:X,alpha:Y,beta:H}=J;return{transA:Q,transB:X,alpha:Y,beta:H,cacheKey:`${J.transA};${J.transB};${J.alpha===1}`}},eO=(J,Q)=>{oM(J.inputs),J.compute(sM(J.inputs,Q))}}),Jz=Q0(()=>{z0(),w0(),Q1(),I0(),[O6,f6,T8,x8]=[0,1,2,3],aM=(J)=>{if(J[0].dims.length!==4)throw Error("only 4-D tensor is supported.");if(J[0].dims.length!==J[1].dims.length)throw Error("input dimensions must be equal to grid dimensions");if(J[0].dims.length-2!==J[1].dims[J[1].dims.length-1])throw Error(`last dimension of grid must be equal to ${J[0].dims.length-2}`);if(J[0].dims[0]!==J[1].dims[0])throw Error("grid batch size must match input batch size")},iM=`
  fn gs_get_cubic_coeffs(x: f32) -> vec4<f32> {
    let cubic_alpha = -0.75f;
    let x_abs = abs(x);
    var coeffs: vec4<f32>;
    coeffs[0] = (((cubic_alpha * (x_abs + 1) - 5 * cubic_alpha) * (x_abs + 1) + 8 * cubic_alpha) * (x_abs + 1) - 4 * cubic_alpha);
    coeffs[1] = (((cubic_alpha + 2) * x_abs - (cubic_alpha + 3)) * x_abs * x_abs + 1);
    coeffs[2] = (((cubic_alpha + 2) * (1 - x_abs) - (cubic_alpha + 3)) * (1 - x_abs) * (1 - x_abs) + 1);
    coeffs[3] = (((cubic_alpha * (2 - x_abs) - 5 * cubic_alpha) * (2 - x_abs) + 8 * cubic_alpha) * (2 - x_abs) - 4 * cubic_alpha);
    return coeffs;
  }
`,nM=(J)=>`
  fn gs_bicubic_interpolate(p: mat4x4<${J}>, x: f32, y: f32) -> ${J} {
    var v: vec4<f32>;
    var coeffs = gs_get_cubic_coeffs(x);
    for (var i = 0; i < 4; i++) {
      v[i] = coeffs[0] * p[i][0] + coeffs[1] * p[i][1] + coeffs[2] * p[i][2] + coeffs[3] * p[i][3];
    }
    coeffs = gs_get_cubic_coeffs(y);
    let pixel = ${J}(coeffs[0] * v[0] + coeffs[1] * v[1] + coeffs[2] * v[2] + coeffs[3] * v[3]);
    return pixel;
  }
`,rM=(J)=>`
  fn gs_denormalize(n: f32, length: i32) -> f32 {
    ${J.alignCorners===0?`
    // alignCorners: false => [-1, 1] to [-0.5, length - 0.5]
    return ((n + 1.0) * f32(length) - 1.0) / 2.0;
    `:`
    // alignCorners: true => [-1, 1] to [0, length - 1]
    return (n + 1.0) / 2.0 * (f32(length - 1));
    `}
  }
`,tM=(J)=>`
  ${J.paddingMode==="reflection"?`
      fn gs_reflect(x: i32, x_min: f32, x_max: f32) -> u32 {
        var dx = 0.0;
        var fx = f32(x);
        let range = x_max - x_min;
        if (fx < x_min) {
          dx = x_min - fx;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_min + r;
          } else {
            fx = x_max - r;
          }
        } else if (fx > x_max) {
          dx = fx - x_max;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_max - r;
          } else {
            fx = x_min + r;
          }
        }
        return u32(fx);
      }`:""}
`,eM=(J,Q,X)=>`
  fn pixel_at_grid(r: i32, c: i32, H: i32, W: i32, batch: u32, channel: u32, border: vec4<f32>) -> ${Q} {
     var pixel = ${Q}(0);
     var indices = vec4<u32>(0);
     indices[${O6}] = batch;
     indices[${f6}] = channel;`+(()=>{switch(X.paddingMode){case"zeros":return`
          if (r >= 0 && r < H && c >=0 && c < W) {
            indices[${T8}] = u32(r);
            indices[${x8}] = u32(c);
          }
        `;case"border":return`
          indices[${T8}] = u32(clamp(r, 0, H - 1));
          indices[${x8}] = u32(clamp(c, 0, W - 1));
        `;case"reflection":return`
          indices[${T8}] = gs_reflect(r, border[1], border[3]);
          indices[${x8}] = gs_reflect(c, border[0], border[2]);
        `;default:throw Error(`padding mode ${X.paddingMode} is not supported`)}})()+`
    return ${J.getByIndices("indices")};
  }
`,JB=(J,Q,X)=>(()=>{switch(X.mode){case"nearest":return`
          let result = pixel_at_grid(i32(round(y)), i32(round(x)), H_in, W_in, indices[${O6}], indices[${f6}], border);
        `;case"bilinear":return`
          let x1 = i32(floor(x));
          let y1 = i32(floor(y));
          let x2 = x1 + 1;
          let y2 = y1 + 1;

          let p11 = pixel_at_grid(y1, x1, H_in, W_in, indices[${O6}], indices[${f6}], border);
          let p12 = pixel_at_grid(y1, x2, H_in, W_in, indices[${O6}], indices[${f6}], border);
          let p21 = pixel_at_grid(y2, x1, H_in, W_in, indices[${O6}], indices[${f6}], border);
          let p22 = pixel_at_grid(y2, x2, H_in, W_in, indices[${O6}], indices[${f6}], border);

          let dx2 = ${Q}(f32(x2) - x);
          let dx1 = ${Q}(x - f32(x1));
          let dy2 = ${Q}(f32(y2) - y);
          let dy1 = ${Q}(y - f32(y1));
          let result = dy2 * (dx2 * p11 + dx1 * p12) + dy1 * (dx2 * p21 + dx1 * p22);
        `;case"bicubic":return`
          let x0 = i32(floor(x)) - 1;
          let y0 = i32(floor(y)) - 1;
          var p: mat4x4<${Q}>;
          for (var h = 0; h < 4; h++) {
            for (var w = 0; w < 4; w++) {
              p[h][w] = pixel_at_grid(h + y0, w + x0, H_in, W_in, indices[${O6}], indices[${f6}], border);
            }
          }

          let dx = x - f32(x0 + 1);
          let dy = y - f32(y0 + 1);
          let result = gs_bicubic_interpolate(p, dx, dy);
        `;default:throw Error(`mode ${X.mode} is not supported`)}})()+`${J.setByOffset("global_idx","result")}`,QB=(J,Q)=>{let X=i("x",J[0].dataType,J[0].dims.length),Y=[J[1].dims[0],J[1].dims[1],J[1].dims[2]],H=i("grid",J[1].dataType,Y.length,2),W=[J[0].dims[0],J[0].dims[1],J[1].dims[1],J[1].dims[2]];Q.format==="NHWC"&&(W=[J[0].dims[0],J[1].dims[1],J[1].dims[2],J[0].dims[3]],[O6,f6,T8,x8]=[0,3,1,2]);let G=B0("output",J[0].dataType,W.length),j=X.type.value,N=u.size(W),V=[{type:12,data:N},...R0(J[0].dims,Y,W)],L=(B)=>`
  ${B.registerUniform("output_size","u32").declareVariables(X,H,G)}
  ${iM}
  ${nM(j)}
  ${rM(Q)}
  ${tM(Q)}
  ${eM(X,j,Q)}

  ${B.mainStart()}
    ${B.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let H_in = i32(uniforms.x_shape[${T8}]);
      let W_in = i32(uniforms.x_shape[${x8}]);

      ${Q.alignCorners===0?`
      let x_min = -0.5;
      let x_max = f32(W_in) - 0.5;
      let y_min = -0.5;
      let y_max = f32(H_in) - 0.5;
      `:`
      let x_min = 0.0;
      let x_max = f32(W_in) - 1.0;
      let y_min = 0.0;
      let y_max = f32(H_in) - 1.0;
      `};
      let border = vec4<f32>(x_min, y_min, x_max, y_max);

      let indices = ${G.offsetToIndices("global_idx")};
      var grid_indices = vec3<u32>(indices[${O6}], indices[${T8}], indices[${x8}]);
      let nxy = ${H.getByIndices("grid_indices")};
      var x = gs_denormalize(f32(nxy[0]), W_in);
      var y = gs_denormalize(f32(nxy[1]), H_in);

      ${JB(G,j,Q)}
  }`;return{name:"GridSample",shaderCache:{hint:`${Q.cacheKey}`,inputDependencies:["type","type"]},getRunData:(B)=>{let U=u.size(W);return{outputs:[{dims:W,dataType:B[0].dataType}],dispatchGroup:{x:Math.ceil(U/64)},programUniforms:V}},getShaderSource:L}},JR=(J,Q)=>{aM(J.inputs),J.compute(QB(J.inputs,Q))},QR=(J)=>d0({alignCorners:J.align_corners,mode:J.mode,paddingMode:J.padding_mode,format:J.format})}),HR=Q0(()=>{z0(),w0(),Q1(),JH(),YH(),I0(),n6(),w1=(J,Q)=>J.length>Q&&J[Q].dims.length>0?J[Q]:void 0,XB=(J,Q)=>{let X=J[0],Y=w1(J,1),H=w1(J,2),W=w1(J,3),G=w1(J,4),j=w1(J,5),N=w1(J,6),V=w1(J,7);if(X.dims.length!==3&&X.dims.length!==5)throw Error("Input query is expected to have 3 or 5 dimensions");let L=X.dims[0],B=X.dims[1],U=X.dims.length===3?X.dims[2]:Q.numHeads*X.dims[4],E=B,R=0,A=0,P=Math.floor(U/Q.numHeads);if(N&&V&&u.size(N.dims)&&u.size(V.dims)){if(N.dims.length!==4)throw Error('Input "past_key" is expected to have 4 dimensions');if(N.dims[0]!==L||N.dims[1]!==Q.numHeads||N.dims[3]!==P)throw Error('Input "past_key" shape (batch_size, num_heads, past_sequence_length, head_size)');if(V.dims[0]!==L||V.dims[1]!==Q.numHeads||V.dims[3]!==P)throw Error('Input "past_value" shape (batch_size, num_heads, past_sequence_length, head_size)');if(N.dims[2]!==V.dims[2])throw Error('Input "past_key" and "past_value" shall have same dim 2 (past_sequence_length)');if(V.dims.length!==4)throw Error('Input "past_value" is expected to have 4 dimensions');R=N.dims[2],A=N.dims[2]}else if(N&&u.size(N.dims)||V&&u.size(V.dims))throw Error('Input "past_key" and "past_value" shall be both present or both absent');let z;if(Y&&u.size(Y.dims)>0){if(X.dims.length!==3)throw Error('Input "query" is expected to have 3 dimensions when key is given');if(Y.dims.length<3||Y.dims.length>5)throw Error('Input "key" is expected to have 3, 4, or 5 dimensions');if(X.dims[0]!==Y.dims[0])throw Error('Input "query" and "key" shall have same dim 0 (batch size)');if(Y.dims.length===3){if(Y.dims[2]!==X.dims[2])throw Error('Input "query" and "key" shall have same dim 2 (hidden_size)');z=2,E=Y.dims[1]}else if(Y.dims.length===5){if(Y.dims[2]!==Q.numHeads||Y.dims[3]!==2||Y.dims[4]!==P)throw Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');if(H)throw Error('Expect "value" be none when "key" has packed kv format.');z=5,E=Y.dims[1]}else{if(Y.dims[1]!==Q.numHeads||Y.dims[3]!==P)throw Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');z=0,E=Y.dims[2]}}else{if(X.dims.length!==5)throw Error('Input "query" is expected to have 5 dimensions when key is empty');if(X.dims[2]!==Q.numHeads||X.dims[3]!==3)throw Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');z=3}if(W&&u.size(W.dims)>0){if(W.dims.length!==1)throw Error('Input "bias" is expected to have 1 dimension');if(Y&&Y.dims.length===5&&Y.dims[3]===2)throw Error("bias is not allowed for packed kv.")}let D=R+E,S=0;if(G&&u.size(G.dims)>0){S=8;let C=G.dims;throw C.length===1?C[0]===L?S=1:C[0]===3*L+2&&(S=3):C.length===2&&C[0]===L&&C[1]===D&&(S=5),S===8?Error('Input "key_padding_mask" shape shall be (batch_size) or (batch_size, total_sequence_length)'):Error("Mask not supported")}let w=!1,k=U;if(H&&u.size(H.dims)>0){if(H.dims.length!==3&&H.dims.length!==4)throw Error('Input "value" is expected to have 3 or 4 dimensions');if(X.dims[0]!==H.dims[0])throw Error('Input "query" and "value" shall have same dim 0 (batch_size)');if(H.dims.length===3){if(E!==H.dims[1])throw Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');k=H.dims[2]}else{if(E!==H.dims[2])throw Error('Input "key" and "value" shall have the same dim 2 (kv_sequence_length)');k=H.dims[1]*H.dims[3],w=!0}}let I=!1;if(G&&u.size(G.dims)>0)throw Error("Key padding mask is not supported");if(j&&u.size(j.dims)>0){if(j.dims.length!==4)throw Error('Input "attention_bias" is expected to have 4 dimensions');if(j.dims[0]!==L||j.dims[1]!==Q.numHeads||j.dims[2]!==B||j.dims[3]!==D)throw Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)')}return{batchSize:L,sequenceLength:B,pastSequenceLength:R,kvSequenceLength:E,totalSequenceLength:D,maxSequenceLength:A,inputHiddenSize:0,hiddenSize:U,vHiddenSize:k,headSize:P,vHeadSize:Math.floor(k/Q.numHeads),numHeads:Q.numHeads,isUnidirectional:!1,pastPresentShareBuffer:!1,maskFilterValue:Q.maskFilterValue,maskType:S,scale:Q.scale,broadcastResPosBias:I,passPastInKv:w,qkvFormat:z}},XR=(J)=>d0({...J}),qY=d0({perm:[0,2,1,3]}),YB=(J,Q,X,Y,H,W,G)=>{let j=[Y,H,W],N=u.size(j),V=[{type:12,data:N},{type:12,data:G},{type:12,data:W}],L=(B)=>{let U=B0("qkv_with_bias",Q.dataType,j),E=i("qkv",Q.dataType,j),R=i("bias",X.dataType,j),A=[{name:"output_size",type:"u32"},{name:"bias_offset",type:"u32"},{name:"hidden_size",type:"u32"}];return`
  ${B.registerUniforms(A).declareVariables(E,R,U)}
  ${B.mainStart()}
    ${B.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let bias_offset_idx = (global_idx % uniforms.hidden_size) + uniforms.bias_offset;

    qkv_with_bias[global_idx] = qkv[global_idx] + bias[bias_offset_idx];
  }`};return J.compute({name:"MultiHeadAttentionAddBias",shaderCache:{inputDependencies:["type","type"]},getRunData:()=>({outputs:[{dims:j,dataType:Q.dataType,gpuDataType:0}],dispatchGroup:{x:Math.ceil(N/64)},programUniforms:V}),getShaderSource:L},{inputs:[Q,X],outputs:[-1]})[0]},i2=(J,Q,X,Y,H,W,G,j)=>{let N=W;if(G&&u.size(G.dims)>0){if(Y===1)throw Error("AddBiasReshape is not implemented. Please export your model with packed QKV or KV");return N=YB(J,W,G,Q,Y,X*H,j),N=N.reshape([Q,Y,X,H]),X===1||Y===1?N:J.compute(y1(N,qY.perm),{inputs:[N],outputs:[-1]})[0]}else return W.dims.length===3&&(N=W.reshape([Q,Y,X,H])),X===1||Y===1?N:J.compute(y1(N,qY.perm),{inputs:[N],outputs:[-1]})[0]},YR=(J,Q)=>{let X=XB(J.inputs,Q),Y=J.inputs[0],H=w1(J.inputs,1),W=w1(J.inputs,2),G=w1(J.inputs,3),j=w1(J.inputs,4),N=w1(J.inputs,5),V=w1(J.inputs,6),L=w1(J.inputs,7);if(Y.dims.length===5)throw Error("Packed QKV is not implemented");if(H?.dims.length===5)throw Error("Packed KV is not implemented");let B=H&&W&&H.dims.length===4&&W.dims.length===4,U=i2(J,X.batchSize,X.numHeads,X.sequenceLength,X.headSize,Y,G,0);if(B)return t2(J,U,H,W,j,void 0,V,L,N,X);if(!H||!W)throw Error("key and value must be provided");let E=i2(J,X.batchSize,X.numHeads,X.kvSequenceLength,X.headSize,H,G,X.hiddenSize),R=i2(J,X.batchSize,X.numHeads,X.kvSequenceLength,X.vHeadSize,W,G,2*X.hiddenSize);t2(J,U,E,R,j,void 0,V,L,N,X)}}),GR=Q0(()=>{z0(),w0(),Q1(),I0(),HB=(J)=>{if(!J||J.length<1)throw Error("too few inputs")},qB=(J,Q)=>{let X=[],Y=Q.numOutputs;return J[1].dims[0]>0&&(J[1].getBigInt64Array().forEach((H)=>X.push(Number(H))),Y=X.length),d0({numOutputs:Y,axis:Q.axis,splitSizes:X})},WB=(J)=>`
fn calculateOutputIndex(index: u32) -> u32 {
    for (var i: u32 = 0u; i < ${J}u; i += 1u ) {
    if (index < ${U0("uniforms.size_in_split_axis","i",J)}) {
        return i;
    }
    }
    return ${J}u;
}`,GB=(J)=>{let Q=J.length,X=[];for(let Y=0;Y<Q;++Y){let H=J[Y].setByIndices("indices","input[global_idx]");Q===1?X.push(H):Y===0?X.push(`if (output_number == ${Y}u) { ${H} }`):Y===Q-1?X.push(`else { ${H} }`):X.push(`else if (output_number == ${Y}) { ${H} }`)}return`
      fn writeBufferData(output_number: u32, indices: ${J[0].type.indices}, global_idx: u32) {
        ${X.join(`
`)}
      }`},yY=(J,Q)=>{let X=J[0].dims,Y=u.size(X),H=J[0].dataType,W=u.normalizeAxis(Q.axis,X.length),G=Array(Q.numOutputs),j=i("input",H,X.length),N=Array(Q.numOutputs),V=[],L=[],B=0,U=[{type:12,data:Y}];for(let R=0;R<Q.numOutputs;R++){B+=Q.splitSizes[R],N[R]=B;let A=X.slice();A[W]=Q.splitSizes[R],L.push(A),G[R]=B0(`output${R}`,H,A.length),V.push({dims:L[R],dataType:J[0].dataType})}U.push({type:12,data:N},...R0(X,...L));let E=(R)=>`
  ${R.registerUniform("input_size","u32").registerUniform("size_in_split_axis","u32",N.length).declareVariables(j,...G)}
  ${WB(N.length)}
  ${GB(G)}

  ${R.mainStart()}
    ${R.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.input_size")}

    var indices = ${j.offsetToIndices("global_idx")};
    var index = ${j.indicesGet("indices",W)};
    let output_number = calculateOutputIndex(index);
    if (output_number != 0) {
      index -= ${U0("uniforms.size_in_split_axis","output_number - 1u",N.length)};
      ${j.indicesSet("indices",W,"index")};
    }
    writeBufferData(output_number, indices, global_idx);
  }`;return{name:"Split",shaderCache:{hint:Q.cacheKey,inputDependencies:["rank"]},getShaderSource:E,getRunData:()=>({outputs:V,dispatchGroup:{x:Math.ceil(Y/64)},programUniforms:U})}},qR=(J,Q)=>{HB(J.inputs);let X=J.inputs.length===1?Q:qB(J.inputs,Q);J.compute(yY(J.inputs,X),{inputs:[0]})},WR=(J)=>{let{axis:Q,splitSizes:X}=J,Y=J.numOutputs<0?X.length:J.numOutputs;if(Y!==X.length)throw Error("numOutputs and splitSizes lengh must be equal");return d0({axis:Q,numOutputs:Y,splitSizes:X})}}),Qz=Q0(()=>{Q1(),YH(),HR(),GR(),n6(),jB=(J,Q)=>{if(Q.doRotary)throw Error("GroupQuerryAttention do_rotary attribute is not supported");if(Q.doRotary&&J.length<=7)throw Error("cos_cache and sin_cache inputs are required if do_rotary is specified");let X=J[0],Y=J[1],H=J[2],W=J[3],G=J[4];if(Q.localWindowSize!==-1)throw Error("Local attention is not supported");if(Q.softcap!==0)throw Error("Softcap is not supported");if(Q.rotaryInterleaved!==0)throw Error("Rotary interleaved is not supported");if(Q.smoothSoftmax)throw Error("Smooth softmax is not supported");if(X.dims.length!==3&&X.dims.length!==5)throw Error("Input query is expected to have 3 or 5 dimensions");let j=!1,N=X.dims[0],V=X.dims[1],L=X.dims.length===3?j?X.dims[2]/3:X.dims[2]:Q.numHeads*X.dims[4],B=V,U=0,E=!Y||Y.dims.length===0,R=Math.floor(E?L/(Q.numHeads+2*Q.kvNumHeads):L/Q.numHeads);E&&(L=R*Q.numHeads);let A=W&&W.dims.length!==0,P=G&&G.dims.length!==0;if(A&&W.dims.length===4&&W.dims[0]===N&&W.dims[1]!==Q.kvNumHeads&&W.dims[2]===Q.kvNumHeads&&W.dims[3]===R)throw Error("BSNH pastKey/pastValue is not supported");if(A&&P){if(W.dims.length!==4)throw Error('Input "past_key" is expected to have 4 dimensions');if(G.dims.length!==4)throw Error('Input "past_value" is expected to have 4 dimensions');U=W.dims[2]}else if(A||P)throw Error('Input "past_key" and "past_value" shall be both present or both absent');let z=1;if(Y&&Y.dims.length>0){if(X.dims.length!==3)throw Error('Input "query" is expected to have 3 dimensions when key is given');if(Y.dims.length<3||Y.dims.length>5)throw Error('Input "key" is expected to have 3, 4, or 5 dimensions');if(X.dims[0]!==Y.dims[0])throw Error('Input "query" and "key" shall have same dim 0 (batch size)');if(Y.dims.length===3){if(X.dims[2]%Y.dims[2]!==0)throw Error('Dimension 2 of "query" should be a multiple of "key"');B=Y.dims[1]}else if(Y.dims.length===5){if(Y.dims[2]!==Q.numHeads||Y.dims[3]!==2||Y.dims[4]!==R)throw Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');if(H)throw Error('Expect "value" be none when "key" has packed kv format.');B=Y.dims[1]}else{if(Y.dims[1]!==Q.numHeads||Y.dims[3]!==R)throw Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');B=Y.dims[2]}}else{if(X.dims.length!==3&&X.dims.length!==5)throw Error('Input "query" is expected to have 3 or 5 dimensions when key is empty');if(X.dims.length===5&&(X.dims[2]!==Q.numHeads||X.dims[3]!==3))throw Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');z=3}let D=0,S=!1,w=Q.kvNumHeads?R*Q.kvNumHeads:L;if(H&&H.dims.length>0){if(H.dims.length!==3&&H.dims.length!==4)throw Error('Input "value" is expected to have 3 or 4 dimensions');if(X.dims[0]!==H.dims[0])throw Error('Input "query" and "value" shall have same dim 0 (batch_size)');if(H.dims.length===3){if(B!==H.dims[1])throw Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');w=H.dims[2]}else{if(B!==H.dims[2])throw Error('Input "past_key" and "past_value" shall have the same dim 2 (kv_sequence_length)');w=H.dims[1]*H.dims[3],S=!0}}let k=J.length>4?J[5]:void 0;if(k&&k.dims.length!==1&&k.dims[0]!==N)throw Error('Input "seqlens" is expected to have 1 dimension and the same dim 0 as batch_size');return{batchSize:N,sequenceLength:V,pastSequenceLength:U,kvSequenceLength:B,totalSequenceLength:-1,maxSequenceLength:-1,inputHiddenSize:0,hiddenSize:L,vHiddenSize:w,headSize:R,vHeadSize:Math.floor(w/Q.kvNumHeads),numHeads:Q.numHeads,kvNumHeads:Q.kvNumHeads,nReps:Q.numHeads/Q.kvNumHeads,pastPresentShareBuffer:!1,maskType:D,scale:Q.scale,broadcastResPosBias:!1,passPastInKv:S,qkvFormat:z}},FB=d0({perm:[0,2,1,3]}),WY=(J,Q,X)=>{let Y=Q,H=X.kvNumHeads;return Q.dims.length===3&&X.kvSequenceLength!==0&&(Y=Q.reshape([X.batchSize,X.kvSequenceLength,H,X.headSize]),Y=J.compute(y1(Y,FB.perm),{inputs:[Y],outputs:[-1]})[0]),Y},jR=(J,Q)=>{let X=jB(J.inputs,Q);if(J.inputs[0].dims.length===5)throw Error("Packed QKV is not implemented");if(J.inputs[1]?.dims.length===5)throw Error("Packed KV is not implemented");let Y=J.inputs[0],H=J.inputs[1]&&J.inputs[1].dims.length>0?J.inputs[1]:void 0,W=J.inputs[2]&&J.inputs[2].dims.length>0?J.inputs[2]:void 0,G=J.inputs[3]&&J.inputs[3].dims.length!==0?J.inputs[3]:void 0,j=J.inputs[4]&&J.inputs[4].dims.length!==0?J.inputs[4]:void 0,N=J.inputs.length>4?J.inputs[5]:void 0,V=J.inputs.length>5?J.inputs[6]:void 0,L=X.kvNumHeads?X.kvNumHeads:X.numHeads,B=d0({axis:2,numOutputs:3,splitSizes:[X.numHeads*X.headSize,L*X.headSize,L*X.headSize]}),[U,E,R]=!H&&!W?J.compute(yY([Y],B),{inputs:[Y],outputs:[-1,-1,-1]}):[Y,H,W],A=i2(J,X.batchSize,X.numHeads,X.sequenceLength,X.headSize,U,void 0,0);t2(J,A,WY(J,E,X),WY(J,R,X),void 0,void 0,G,j,void 0,X,N,V)}}),Xz=Q0(()=>{z0(),w0(),n6(),I0(),GY=(J,Q,X,Y,H,W,G,j)=>{let N=e0(W),V=N===1?"f32":`vec${N}f`,L=N===1?"vec2f":`mat2x${N}f`,B=H*G,U=64;B===1&&(U=256);let E=[H,G,W/N],R=[H,G,2],A=["rank","type","type"],P=[];P.push(...R0(E,R));let z=(D)=>{let S=i("x",Q.dataType,3,N),w=i("scale",X.dataType,X.dims),k=i("bias",Y.dataType,Y.dims),I=B0("output",1,3,2),C=[S,w,k,I];return`
  var<workgroup> workgroup_shared : array<${L}, ${U}>;
  const workgroup_size = ${U}u;
  ${D.declareVariables(...C)}
  ${D.mainStart(U)}
    let batch = workgroup_index / uniforms.x_shape[1];
    let channel = workgroup_index % uniforms.x_shape[1];
    let hight = uniforms.x_shape[2];
    // initialize workgroup memory
    var sum = ${V}(0);
    var squared_sum = ${V}(0);
    for (var h = local_idx; h < hight; h += workgroup_size) {
      let value = ${V}(${S.get("batch","channel","h")});
      sum += value;
      squared_sum += value * value;
    }
    workgroup_shared[local_idx] = ${L}(sum, squared_sum);
    workgroupBarrier();

    for (var currSize = workgroup_size >> 1;  currSize > 0; currSize = currSize >> 1) {
      if (local_idx < currSize) {
        workgroup_shared[local_idx] = workgroup_shared[local_idx] + workgroup_shared[local_idx + currSize];
      }
      workgroupBarrier();
    }
    if (local_idx == 0) {
      let sum_final = ${i6("workgroup_shared[0][0]",N)} / f32(hight * ${N});
      let squared_sum_final = ${i6("workgroup_shared[0][1]",N)} / f32(hight * ${N});

      let inv_std_dev = inverseSqrt(squared_sum_final - sum_final * sum_final + f32(${j}));
      let channel_scale = inv_std_dev * f32(scale[channel]);
      let channel_shift = f32(bias[channel]) - sum_final * channel_scale;
      output[workgroup_index] = vec2f(channel_scale, channel_shift);
    }
  }`};return J.compute({name:"InstanceNormComputeChannelScaleShift",shaderCache:{hint:`${N};${j};${U}`,inputDependencies:A},getRunData:()=>({outputs:[{dims:R,dataType:1}],dispatchGroup:{x:B},programUniforms:P}),getShaderSource:z},{inputs:[Q,X,Y],outputs:[-1]})[0]},NB=(J,Q,X)=>{let Y=Q[0].dims,H=Y,W=2,G=Y[0],j=Y[1],N=u.sizeFromDimension(Y,W),V=e0(N),L=u.size(H)/V,B=GY(J,Q[0],Q[1],Q[2],G,N,j,X.epsilon),U=[G,j,N/V],E=[G,j],R=["type","none"],A=(P)=>{let z=i("x",Q[0].dataType,U.length,V),D=i("scale_shift",1,E.length,2),S=B0("output",Q[0].dataType,U.length,V),w=[z,D,S];return`
  ${P.registerUniform("output_size","u32").declareVariables(...w)}
  ${P.mainStart()}
  ${P.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let outputIndices = ${S.offsetToIndices("global_idx")};
      let batch = outputIndices[0];
      let channel = outputIndices[1];
      let scale_shift = ${D.getByIndices("vec2<u32>(batch, channel)")};
      let value = ${z.getByOffset("global_idx")} * ${S.type.value}(scale_shift.x) + ${S.type.value}(scale_shift.y);
      ${S.setByOffset("global_idx","value")};
  }`};J.compute({name:"InstanceNormalization",shaderCache:{hint:`${V}`,inputDependencies:R},getRunData:()=>({outputs:[{dims:H,dataType:Q[0].dataType}],dispatchGroup:{x:Math.ceil(L/64)},programUniforms:[{type:12,data:L},...R0(U,E,U)]}),getShaderSource:A},{inputs:[Q[0],B]})},VB=(J,Q,X)=>{let Y=Q[0].dims,H=Y,W=Y[0],G=Y[Y.length-1],j=u.sizeFromDimension(Y,1)/G,N=e0(G),V=u.size(H)/N,L=[{type:12,data:j},{type:12,data:Math.floor(G/N)}],B=["type","type"],U=!1,E=[0,Y.length-1];for(let z=0;z<Y.length-2;z++)U=U||Y[z+1]!==1,E.push(z+1);U=U&&Y[Y.length-1]!==1;let R=U?J.compute(y1(J.inputs[0],E),{inputs:[J.inputs[0]],outputs:[-1]})[0]:J.inputs[0].reshape(Array.from({length:Y.length},(z,D)=>Y[E[D]])),A=GY(J,R,Q[1],Q[2],W,j,G,X.epsilon),P=(z)=>{let D=K1(Q[0].dataType),S=N===1?"vec2f":`mat${N}x2f`,w=(C)=>{let T=C===0?"x":"y",g=N===1?"f32":`vec${N}f`;switch(N){case 1:return`${D}(${g}(scale.${T}))`;case 2:return`vec2<${D}>(${g}(scale[0].${T}, scale[1].${T}))`;case 4:return`vec4<${D}>(${g}(scale[0].${T}, scale[1].${T}, scale[2].${T}, scale[3].${T}))`;default:throw Error(`Not supported compoents ${N}`)}},k=i("input",Q[0].dataType,Q[0].dims,N),I=B0("output",Q[0].dataType,H,N);return`
  @group(0) @binding(0) var<storage, read> input : array<${k.type.storage}>;
  @group(0) @binding(1) var<storage, read> scale_input : array<${S}>;
  @group(0) @binding(2) var<storage, read_write> output : array<${I.type.storage}>;
  struct Uniforms {H: u32, C : u32};
  @group(0) @binding(3) var<uniform> uniforms: Uniforms;

  ${z.mainStart()}
    let current_image_number = global_idx / (uniforms.C * uniforms.H);
    let current_channel_number = global_idx % uniforms.C;

    let scale_offset = current_image_number * uniforms.C + current_channel_number;
    let scale = scale_input[scale_offset];
    output[global_idx] = fma(input[global_idx], ${w(0)}, ${w(1)});
  }`};J.compute({name:"InstanceNormalizationNHWC",shaderCache:{hint:`${N}`,inputDependencies:B},getRunData:()=>({outputs:[{dims:H,dataType:Q[0].dataType}],dispatchGroup:{x:Math.ceil(V/64)},programUniforms:L}),getShaderSource:P},{inputs:[Q[0],A]})},FR=(J,Q)=>{Q.format==="NHWC"?VB(J,J.inputs,Q):NB(J,J.inputs,Q)}}),Yz=Q0(()=>{z0(),w0(),I0(),KB=(J)=>{if(!J||J.length<2)throw Error("layerNorm requires at least 2 inputs.")},MB=(J,Q,X)=>{let Y=Q.simplified,H=J[0].dims,W=J[1],G=!Y&&J[2],j=H,N=u.normalizeAxis(Q.axis,H.length),V=u.sizeToDimension(H,N),L=u.sizeFromDimension(H,N),B=u.size(W.dims),U=G?u.size(G.dims):0;if(B!==L||G&&U!==L)throw Error(`Size of X.shape()[axis:] == ${L}.
       Size of scale and bias (if provided) must match this.
       Got scale size of ${B} and bias size of ${U}`);let E=[];for(let k=0;k<H.length;++k)k<N?E.push(H[k]):E.push(1);let R=e0(L),A=["type","type"],P=[{type:12,data:V},{type:1,data:L},{type:12,data:Math.floor(L/R)},{type:1,data:Q.epsilon}];G&&A.push("type");let z=X>1,D=X>2,S=(k)=>{let I=K1(J[0].dataType),C=[i("x",J[0].dataType,J[0].dims,R),i("scale",W.dataType,W.dims,R)];G&&C.push(i("bias",G.dataType,G.dims,R)),C.push(B0("output",J[0].dataType,j,R)),z&&C.push(B0("mean_data_output",1,E)),D&&C.push(B0("inv_std_output",1,E));let T=[{name:"norm_count",type:"u32"},{name:"norm_size",type:"f32"},{name:"norm_size_vectorized",type:"u32"},{name:"epsilon",type:"f32"}];return`
  ${k.registerUniforms(T).declareVariables(...C)}
  ${k.mainStart()}
    ${k.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.norm_count")}
    let offset = global_idx * uniforms.norm_size_vectorized;
    var mean_vector = ${CY("f32",R)};
    var mean_square_vector = ${CY("f32",R)};

    for (var h: u32 = 0u; h < uniforms.norm_size_vectorized; h++) {
      let value = ${H7(I,R,"x[h + offset]")};
      mean_vector += value;
      mean_square_vector += value * value;
    }
    let mean = ${i6("mean_vector",R)} / uniforms.norm_size;
    let inv_std_dev = inverseSqrt(${i6("mean_square_vector",R)} / uniforms.norm_size ${Y?"":"- mean * mean"} + uniforms.epsilon);

    for (var j: u32 = 0; j < uniforms.norm_size_vectorized; j++) {
      let f32input = ${H7(I,R,"x[j + offset]")};
      let f32scale = ${H7(I,R,"scale[j]")};
      output[j + offset] = ${C[0].type.value}((f32input ${Y?"":"- mean"}) * inv_std_dev * f32scale
        ${G?`+ ${H7(I,R,"bias[j]")}`:""}
      );
    }

    ${z?"mean_data_output[global_idx] = mean":""};
    ${D?"inv_std_output[global_idx] = inv_std_dev":""};
  }`},w=[{dims:j,dataType:J[0].dataType}];return z&&w.push({dims:E,dataType:1}),D&&w.push({dims:E,dataType:1}),{name:"LayerNormalization",shaderCache:{hint:`${R};${X};${Y}`,inputDependencies:A},getRunData:()=>({outputs:w,dispatchGroup:{x:Math.ceil(V/64)},programUniforms:P}),getShaderSource:S}},NR=(J,Q)=>{KB(J.inputs),J.compute(MB(J.inputs,Q,J.outputCount))}}),Hz=Q0(()=>{w0(),jH(),FH(),BB=(J)=>{if(!J||J.length!==2)throw Error("MatMul requires 2 inputs.");if(J[0].dims[J[0].dims.length-1]!==J[1].dims[J[1].dims.length-2])throw Error("shared dimension does not match.")},VR=(J)=>{BB(J.inputs);let Q=q7.calcShape(J.inputs[0].dims,J.inputs[1].dims,!0);if(!Q)throw Error("Can't use matmul on the given tensors");let X=Q[Q.length-1],Y=J.inputs[0].dims[J.inputs[0].dims.length-1];if(X<8&&Y<8)J.compute(GH(J.inputs,{activation:""},Q));else{let H=Q[Q.length-2],W=u.size(J.inputs[0].dims.slice(0,-2)),G=u.size(J.inputs[1].dims.slice(0,-2));if(W!==1&&H===1&&G===1){let j=J.inputs[0].reshape([1,W,Y]),N=J.inputs[1].reshape([1,Y,X]),V=[1,W,X],L=[j,N];J.compute(N4(L,{activation:""},Q,V),{inputs:L})}else J.compute(N4(J.inputs,{activation:""},Q))}}}),qz=Q0(()=>{z0(),w0(),Q1(),I0(),LB=(J,Q)=>{if(J.length<3||J.length>4)throw Error("MatMulNBits requires 3 or 4 inputs");let X=J[0],Y=X.dims.length;if(X.dims[Y-1]!==Q.k)throw Error("The last dim of input shape does not match the k value");let H=Math.floor((Q.k+Q.blockSize-1)/Q.blockSize),W=Q.blockSize/8*Q.bits,G=J[1];if(!u.areEqual(G.dims,[Q.n,H,W]))throw Error("The second inputs must be 3D tensor with shape N X nBlocksPerCol X blobSize");let j=J[2].dims;if(u.size(j)!==Q.n*H)throw Error("scales input size error.");if(J.length===4){let N=J[3].dims,V=Q.bits>4?Q.n*H:Q.n*Math.floor((H+1)/2);if(u.size(N)!==V)throw Error("zeroPoints input size error.")}},UB=(J,Q)=>{let X=J[0].dims,Y=X.length,H=X[Y-2],W=Q.k,G=Q.n,j=X.slice(0,Y-2),N=u.size(j),V=J[1].dims[2]/4,L=J[0].dataType,B=e0(Q.k),U=e0(V),E=e0(G),R=j.concat([H,G]),A=H>1&&G/E%2===0?2:1,P=u.size(R)/E/A,z=64,D=[],S=[N,H,W/B],w=u.convertShape(J[1].dims).slice();w.splice(-1,1,V/U),D.push(...R0(S)),D.push(...R0(w)),D.push(...R0(J[2].dims)),J.length===4&&D.push(...R0(u.convertShape(J[3].dims)));let k=[N,H,G/E];D.push(...R0(k));let I=(C)=>{let T=S.length,g=i("a",J[0].dataType,T,B),m=i("b",12,w.length,U),l=i("scales",J[2].dataType,J[2].dims.length),t=[g,m,l],h=J.length===4?i("zero_points",12,J[3].dims.length):void 0;h&&t.push(h);let W0=k.length,j0=B0("output",J[0].dataType,W0,E),o=K1(J[0].dataType),G0=(()=>{switch(B){case 1:return`array<${o}, 8>`;case 2:return`mat4x2<${o}>`;case 4:return`mat2x4<${o}>`;default:throw Error(`${B}-component is not supported.`)}})(),F0=()=>{let f=`
          // reuse a data
            var input_offset = ${g.indicesToOffset(`${g.type.indices}(batch, row, word_offset)`)};
            var a_data: ${G0};
            for (var j: u32 = 0; j < ${8/B}; j++) {
              a_data[j] = ${g.getByOffset("input_offset")};
              input_offset++;
            }
          `;for(let p=0;p<E*A;p++)f+=`
            b_value = ${U===1?`b${p}_data`:`b${p}_data[i]`};
            b_value_lower = unpack4xU8(b_value & b_mask);
            b_value_upper = unpack4xU8((b_value >> 4) & b_mask);
            b_quantized_values = ${G0}(${Array.from({length:4},(v,r)=>`${o}(b_value_lower[${r}]), ${o}(b_value_upper[${r}])`).join(", ")});
            b_dequantized_values = ${B===1?`${G0}(${Array.from({length:8},(v,r)=>`(b_quantized_values[${r}] - ${h?`zero_point${p}`:"zero_point"}) * scale${p}`).join(", ")});`:`(b_quantized_values - ${G0}(${Array(8).fill(`${h?`zero_point${p}`:"zero_point"}`).join(",")})) * scale${p};`};
            workgroup_shared[local_id.x * ${A} + ${Math.floor(p/E)}]${E>1?`[${p%E}]`:""} += ${Array.from({length:8/B},(v,r)=>`${B===1?`a_data[${r}] * b_dequantized_values[${r}]`:`dot(a_data[${r}], b_dequantized_values[${r}])`}`).join(" + ")};
          `;return f},s=()=>{let f=`
            var col_index = col * ${E};
            ${h?`
            let zero_point_bytes_per_col = (nBlocksPerCol + 1) / 2;
            var zero_point_byte_count: u32;
            var zero_point_word_index: u32;
            var zero_point_byte_offset: u32;
            let zero_point_nibble_offset: u32 = block & 0x1u;
            var zero_point_bits_offset: u32;
            var zero_point_word: u32;`:`
            // The default zero point is 8 for unsigned 4-bit quantization.
            let zero_point = ${o}(8);`}
            `;for(let p=0;p<E*A;p++)f+=`
            let scale${p} = ${l.getByOffset("col_index * nBlocksPerCol + block")};
            ${h?`
            zero_point_byte_count = col_index * zero_point_bytes_per_col + (block >> 0x1u);
            zero_point_word_index = zero_point_byte_count >> 0x2u;
            zero_point_byte_offset = zero_point_byte_count & 0x3u;
            zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_nibble_offset << 2);
            zero_point_word = ${h.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point${p} = ${o}((zero_point_word) & 0xFu);`:""}
            col_index += 1;`;return f},N0=()=>{let f=`col_index = col * ${E};`;for(let p=0;p<E*A;p++)f+=`
            let b${p}_data = ${m.getByIndices(`${m.type.indices}(col_index, block, word)`)};
            col_index += 1;`;return f+=`
            var b_value: u32;
            let b_mask: u32 = 0x0F0F0F0Fu;
            var b_value_lower: vec4<u32>;
            var b_value_upper: vec4<u32>;
            var b_quantized_values: ${G0};
            var b_dequantized_values: ${G0};`,f};return`
        var<workgroup> workgroup_shared: array<${j0.type.value}, ${A*z}>;
        ${C.declareVariables(...t,j0)}
        ${C.mainStart([z,1,1])}
          let output_indices = ${j0.offsetToIndices(`(global_idx / ${z}) * ${A}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let nBlocksPerCol = uniforms.b_shape[1];

          for (var block = local_id.x; block < nBlocksPerCol; block += ${z}) {
            //process one block
            var word_offset: u32 = block * ${Q.blockSize/B};
            ${s()}
            for (var word: u32 = 0; word < ${V}; word += ${U}) {
              ${N0()}
              for (var i: u32 = 0; i < ${U}; i++) {
                ${F0()}
                word_offset += ${8/B};
              }
            }
          }
          workgroupBarrier();

          if (local_id.x < ${A}) {
            var output_value: ${j0.type.value} = ${j0.type.value}(0);
            var workgroup_shared_offset: u32 = local_id.x;
            for (var b: u32 = 0u; b < ${z}u; b++) {
              output_value += workgroup_shared[workgroup_shared_offset];
              workgroup_shared_offset += ${A};
            }
            ${j0.setByIndices(`${j0.type.indices}(batch, row, col + local_id.x)`,"output_value")};
          }
        }`};return{name:"MatMulNBits",shaderCache:{hint:`${Q.blockSize};${Q.bits};${B};${U};${E};${A};${z}`,inputDependencies:Array(J.length).fill("rank")},getRunData:()=>({outputs:[{dims:R,dataType:L}],dispatchGroup:{x:P},programUniforms:D}),getShaderSource:I}},OB=(J,Q)=>{let X=J[0].dims,Y=X.length,H=X[Y-2],W=Q.k,G=Q.n,j=X.slice(0,Y-2),N=u.size(j),V=J[1].dims[2]/4,L=J[0].dataType,B=e0(Q.k),U=e0(V),E=j.concat([H,G]),R=128,A=G%8===0?8:G%4===0?4:1,P=R/A,z=P*U*8,D=z/B,S=z/Q.blockSize,w=u.size(E)/A,k=[],I=[N,H,W/B],C=u.convertShape(J[1].dims).slice();C.splice(-1,1,V/U),k.push(...R0(I)),k.push(...R0(C)),k.push(...R0(J[2].dims)),J.length===4&&k.push(...R0(u.convertShape(J[3].dims)));let T=[N,H,G];k.push(...R0(T));let g=(m)=>{let l=I.length,t=i("a",J[0].dataType,l,B),h=i("b",12,C.length,U),W0=i("scales",J[2].dataType,J[2].dims.length),j0=[t,h,W0],o=J.length===4?i("zero_points",12,J[3].dims.length):void 0;o&&j0.push(o);let G0=T.length,F0=B0("output",J[0].dataType,G0),s=K1(J[0].dataType),N0=()=>{switch(B){case 1:return`
          let a_data0 = vec4<${s}>(sub_a[word_offset], sub_a[word_offset + 1], sub_a[word_offset + 2], sub_a[word_offset + 3]);
          let a_data1 = vec4<${s}>(sub_a[word_offset + 4], sub_a[word_offset + 5], sub_a[word_offset + 6], sub_a[word_offset + 7]);`;case 2:return`
          let a_data0 = vec4<${s}>(sub_a[word_offset], sub_a[word_offset + 1]);
          let a_data1 = vec4<${s}>(sub_a[word_offset + 2], sub_a[word_offset + 3]);`;case 4:return`
          let a_data0 = sub_a[word_offset];
          let a_data1 = sub_a[word_offset + 1];`;default:throw Error(`${B}-component is not supported.`)}};return`
        var<workgroup> sub_a: array<${t.type.value}, ${D}>;
        var<workgroup> inter_results: array<array<${F0.type.value}, ${P}>, ${A}>;
        ${m.declareVariables(...j0,F0)}
        ${m.mainStart([P,A,1])}
          let output_indices = ${F0.offsetToIndices(`workgroup_index * ${A}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let n_blocks_per_col = uniforms.b_shape[1];
          let num_tiles =  (n_blocks_per_col - 1) / ${S} + 1;

          // Loop over shared dimension.
          for (var tile: u32 = 0; tile < num_tiles; tile += 1) {
            let a_col_start = tile * ${D};
            // load one tile A data into shared memory.
            for (var a_offset = local_idx; a_offset < ${D}; a_offset += ${R})
            {
              let a_col = a_col_start + a_offset;
              if (a_col < uniforms.a_shape[2])
              {
                sub_a[a_offset] = ${t.getByIndices(`${t.type.indices}(batch, row, a_col)`)};
              } else {
                sub_a[a_offset] = ${t.type.value}(0);
              }
            }
            workgroupBarrier();

            // each thread process one block
            let b_row = col + local_id.y;
            let block = tile * ${S} + local_id.x;
            ${o?`
            let zero_point_bytes_per_col = (n_blocks_per_col + 1) / 2;
            let zero_point_byte_count = b_row * zero_point_bytes_per_col + (block >> 0x1u);
            let zero_point_word_index = zero_point_byte_count >> 0x2u;
            let zero_point_byte_offset = zero_point_byte_count & 0x3u;
            let zero_point_nibble_offset: u32 = block & 0x1u;
            let zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_nibble_offset << 2);
            let zero_point_word = ${o.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point = ${s}((zero_point_word) & 0xFu);`:`
            // The default zero point is 8 for unsigned 4-bit quantization.
            let zero_point = ${s}(8);`}
            let scale = ${W0.getByOffset("b_row * n_blocks_per_col + block")};
            let b_data = ${h.getByIndices(`${h.type.indices}(b_row, block, 0)`)};
            var word_offset = local_id.x * ${Q.blockSize/B};
            for (var i: u32 = 0; i < ${U}; i++) {
              ${N0()}
              let b_value = ${U===1?"b_data":"b_data[i]"};
              let b_value_lower = unpack4xU8(b_value & 0x0F0F0F0Fu);
              let b_value_upper = unpack4xU8((b_value >> 4) & 0x0F0F0F0Fu);
              let b_quantized_values = mat2x4<${s}>(${Array.from({length:4},(f,p)=>`${s}(b_value_lower[${p}]), ${s}(b_value_upper[${p}])`).join(", ")});
              let b_dequantized_values = (b_quantized_values - mat2x4<${s}>(${Array(8).fill("zero_point").join(",")})) * scale;
              inter_results[local_id.y][local_id.x] += ${Array.from({length:2},(f,p)=>`${`dot(a_data${p}, b_dequantized_values[${p}])`}`).join(" + ")};
              word_offset += ${8/B};
            }
            workgroupBarrier();
          }

          if (local_idx < ${A}) {
            var output_value: ${F0.type.value} = ${F0.type.value}(0);
            for (var b = 0u; b < ${P}; b++) {
              output_value += inter_results[local_idx][b];
            }
            if (col + local_idx < uniforms.output_shape[2])
            {
              ${F0.setByIndices(`${F0.type.indices}(batch, row, col + local_idx)`,"output_value")}
            }
          }
        }`};return{name:"BlockwiseMatMulNBits32",shaderCache:{hint:`${Q.blockSize};${B};${U};${P};${A}`,inputDependencies:Array(J.length).fill("rank")},getRunData:()=>({outputs:[{dims:E,dataType:L}],dispatchGroup:{x:w},programUniforms:k}),getShaderSource:g}},KR=(J,Q)=>{LB(J.inputs,Q),Q.blockSize===32&&J.adapterInfo.isVendor("intel")&&J.adapterInfo.isArchitecture("gen-12lp")?J.compute(OB(J.inputs,Q)):J.compute(UB(J.inputs,Q))},MR=(J)=>d0(J)}),Wz=Q0(()=>{z0(),w0(),I0(),RB=(J)=>{if(!J||J.length<1)throw Error("Too few inputs");if(J[0].dataType!==1&&J[0].dataType!==10)throw Error("Input type must be float or float16.");if(J.length>=2){let Q=J[0].dims.length*2===J[1].dims[0];if(J.length===4&&(Q=J[3].dims[0]*2===J[1].dims[0]),!Q)throw Error("The pads should be a 1D tensor of shape [2 * input_rank] or [2 * num_axes].")}},EB=(J,Q,X)=>{let Y="";for(let H=Q-1;H>=0;--H)Y+=`
            k = i32(${J.indicesGet("indices",H)}) - ${U0("uniforms.pads",H,X)};
            if (k < 0) {
              break;
            }
            if (k >= i32(${U0("uniforms.x_shape",H,Q)})) {
              break;
            }
            offset += k * i32(${U0("uniforms.x_strides",H,Q)});
        `;return`
          value = ${J.type.value}(uniforms.constant_value);
          for (var i = 0; i < 1; i++) {
            var offset = 0;
            var k = 0;
            ${Y}
            value = x[offset];
          }
      `},DB=(J,Q,X)=>{let Y="";for(let H=Q-1;H>=0;--H)Y+=`
                k = i32(${J.indicesGet("indices",H)}) - ${U0("uniforms.pads",H,X)};
                if (k < 0) {
                  k = -k;
                }
                {
                  let _2n_1 = 2 * (i32(${U0("uniforms.x_shape",H,Q)}) - 1);
                  k = k % _2n_1;
                  if(k >= i32(${U0("uniforms.x_shape",H,Q)})) {
                    k = _2n_1 - k;
                  }
                }
                offset += k * i32(${U0("uniforms.x_strides",H,Q)});
            `;return`
              var offset = 0;
              var k = 0;
              ${Y}
              value = x[offset];
          `},AB=(J,Q,X)=>{let Y="";for(let H=Q-1;H>=0;--H)Y+=`
                k = i32(${J.indicesGet("indices",H)}) - ${U0("uniforms.pads",H,X)};
                if (k < 0) {
                  k = 0;
                }
                if (k >= i32(${U0("uniforms.x_shape",H,Q)})) {
                  k = i32(${U0("uniforms.x_shape",H,Q)}) - 1;
                }
                offset += k * i32(${U0("uniforms.x_strides",H,Q)});
            `;return`
              var offset = 0;
              var k = 0;
              ${Y}
              value = x[offset];
          `},zB=(J,Q,X)=>{let Y="";for(let H=Q-1;H>=0;--H)Y+=`
                k = i32(${J.indicesGet("indices",H)}) - ${U0("uniforms.pads",H,X)};
                if (k < 0)  {
                  k += i32(${U0("uniforms.x_shape",H,Q)}]);
                }
                if (k >= i32(${U0("uniforms.x_shape",H,Q)})) {
                  k -= i32(${U0("uniforms.x_shape",H,Q)});
                }
                offset += k * i32(${U0("uniforms.x_strides",H,Q)});
            `;return`
              var offset = 0;
              var k = 0;
              ${Y}
              value = x[offset];
          `},$B=(J,Q,X)=>{switch(X.mode){case 0:return EB(J,Q,X.pads.length);case 1:return DB(J,Q,X.pads.length);case 2:return AB(J,Q,X.pads.length);case 3:return zB(J,Q,X.pads.length);default:throw Error("Invalid mode")}},PB=(J,Q)=>{let X=u.padShape(J[0].dims.slice(),Q.pads),Y=J[0].dims,H=u.size(X),W=[{type:12,data:H},{type:6,data:Q.pads}],G=J.length>=3&&J[2].data;Q.mode===0&&W.push({type:G?J[2].dataType:1,data:Q.value}),W.push(...R0(J[0].dims,X));let j=["rank"],N=(V)=>{let L=B0("output",J[0].dataType,X.length),B=i("x",J[0].dataType,Y.length),U=B.type.value,E=$B(L,Y.length,Q),R=[{name:"output_size",type:"u32"},{name:"pads",type:"i32",length:Q.pads.length}];return Q.mode===0&&R.push({name:"constant_value",type:G?U:"f32"}),`
            ${V.registerUniforms(R).declareVariables(B,L)}
            ${V.mainStart()}
            ${V.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

            let indices = ${L.offsetToIndices("global_idx")};

            var value = ${U}(0);
            ${E}
            output[global_idx] = value;
        }`};return{name:"Pad",shaderCache:{hint:`${Q.mode}${G}`,inputDependencies:j},getRunData:()=>({outputs:[{dims:X,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(u.size(X)/64)},programUniforms:W}),getShaderSource:N}},SB=(J,Q)=>{if(J.length>1){let X=J[1].getBigInt64Array(),Y=J.length>=3&&J[2].data?J[2].dataType===10?J[2].getUint16Array()[0]:J[2].getFloat32Array()[0]:0,H=J[0].dims.length,W=new Int32Array(2*H).fill(0);if(J.length>=4){let j=J[3].getBigInt64Array();for(let N=0;N<j.length;N++)W[Number(j[N])]=Number(X[N]),W[Number(j[N])+H]=Number(X[N+j.length])}else X.forEach((j,N)=>W[Number(N)]=Number(j));let G=[];return W.forEach((j)=>G.push(j)),{mode:Q.mode,value:Y,pads:G}}else return Q},BR=(J,Q)=>{RB(J.inputs);let X=SB(J.inputs,Q);J.compute(PB(J.inputs,X),{inputs:[0]})}}),Gz=Q0(()=>{M6(),z0(),w0(),I0(),c2=(J)=>{if(i0.webgpu.validateInputContent&&(!J||J.length!==1))throw Error("Pool ops requires 1 input.")},jY=(J,Q,X)=>{let Y=Q.format==="NHWC",H=J.dims.slice();Y&&H.splice(1,0,H.pop());let W=Object.hasOwnProperty.call(Q,"dilations"),G=Q.kernelShape.slice(),j=Q.strides.slice(),N=W?Q.dilations.slice():[],V=Q.pads.slice();j4.adjustPoolAttributes(X,H,G,j,N,V);let L=j4.computePoolOutputShape(X,H,j,N,G,V,Q.autoPad),B=Object.assign({},Q);W?Object.assign(B,{kernelShape:G,strides:j,pads:V,dilations:N,cacheKey:Q.cacheKey}):Object.assign(B,{kernelShape:G,strides:j,pads:V,cacheKey:Q.cacheKey});let U=L.slice();return U.push(U.splice(1,1)[0]),[B,Y?U:L]},FY=(J,Q)=>{let X=Q.format==="NHWC",Y=u.size(J),H=u.size(Q.kernelShape),W=[{type:12,data:Y},{type:12,data:H}],G=[{name:"outputSize",type:"u32"},{name:"kernelSize",type:"u32"}];if(Q.kernelShape.length<=2){let j=Q.kernelShape[Q.kernelShape.length-1],N=Q.strides[Q.strides.length-1],V=Q.pads[Q.pads.length/2-1],L=Q.pads[Q.pads.length-1],B=!!(V+L);W.push({type:12,data:j},{type:12,data:N},{type:12,data:V},{type:12,data:L}),G.push({name:"kw",type:"u32"},{name:"sw",type:"u32"},{name:"pwStart",type:"u32"},{name:"pwEnd",type:"u32"});let U=!1;if(Q.kernelShape.length===2){let E=Q.kernelShape[Q.kernelShape.length-2],R=Q.strides[Q.strides.length-2],A=Q.pads[Q.pads.length/2-2],P=Q.pads[Q.pads.length-2];U=!!(A+P),W.push({type:12,data:E},{type:12,data:R},{type:12,data:A},{type:12,data:P}),G.push({name:"kh",type:"u32"},{name:"sh",type:"u32"},{name:"phStart",type:"u32"},{name:"phEnd",type:"u32"})}return[W,G,!0,B,U]}else{if(X)throw Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");let j=u.computeStrides(Q.kernelShape);W.push({type:12,data:j},{type:12,data:Q.pads},{type:12,data:Q.strides}),G.push({name:"kernelStrides",type:"u32",length:j.length},{name:"pads",type:"u32",length:Q.pads.length},{name:"strides",type:"u32",length:Q.strides.length});let N=Q.pads.reduce((V,L)=>V+L);return[W,G,!!N,!1,!1]}},NY=(J,Q,X,Y,H,W,G,j,N,V,L,B)=>{let U=H.format==="NHWC",E=Q.type.value,R=B0("output",Q.type.tensor,Y);if(H.kernelShape.length<=2){let A="",P="",z="",D=X-(U?2:1);if(L?A=`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${D}] = indices[${D}] * uniforms.sw - uniforms.pwStart + i;
                  if (xIndices[${D}] < 0 || xIndices[${D}]
                      >= uniforms.x_shape[${D}]) {
                    pad++;
                    continue;
                  }
                  let x_val = x[${Q.indicesToOffset("xIndices")}];
                  ${W}
                }`:A=`
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${D}] = indices[${D}] * uniforms.sw - uniforms.pwStart + i;
                  let x_val = x[${Q.indicesToOffset("xIndices")}];
                  ${W}
                }`,H.kernelShape.length===2){let S=X-(U?3:2);B?P=`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${S}] = indices[${S}] * uniforms.sh - uniforms.phStart + j;
                  if (xIndices[${S}] < 0 || xIndices[${S}] >= uniforms.x_shape[${S}]) {
                    pad += i32(uniforms.kw);
                    continue;
                  }
              `:P=`
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${S}] = indices[${S}] * uniforms.sh - uniforms.phStart + j;
                `,z=`
              }
            `}return`
            ${J.registerUniforms(N).declareVariables(Q,R)}

            ${J.mainStart()}
              ${J.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

              let indices = ${R.offsetToIndices("global_idx")};
              var xIndices = ${R.offsetToIndices("global_idx")};

              var value = ${E}(${j});
              var pad = 0;
              ${P}
              ${A}
              ${z}
              ${G}

              output[global_idx] = value;
            }`}else{if(U)throw Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");let A=H.kernelShape.length,P=H.pads.length,z="";return V?z=`
                if (xIndices[j] >= uniforms.x_shape[j]) {
                  pad++;
                  isPad = true;
                  break;
                }
              }
              if (!isPad) {
                let x_val = x[${Q.indicesToOffset("xIndices")}];
                ${W}
              }`:z=`
              }
              let x_val = x[${Q.indicesToOffset("xIndices")}];
              ${W}
            `,`
            ${J.registerUniforms(N).declareVariables(Q,R)}

            ${J.mainStart()}
              ${J.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
              let indices = ${R.offsetToIndices("global_idx")};
              var xIndices = ${R.offsetToIndices("global_idx")};

              var offsets: array<u32, ${A}>;

              var value = ${E}(${j});
              var pad = 0;
              var isPad = false;

              for (var i: u32 = 0u; i < uniforms.kernelSize; i++) {
                var offset = i;
                for (var j = 0u; j < ${A-1}u; j++) {
                  offsets[j] = offset / ${U0("uniforms.kernelStrides","j",A)};
                  offset -= offsets[j] * ${U0("uniforms.kernelStrides","j",A)};
                }
                offsets[${A-1}] = offset;

                isPad = false;
                for (var j = ${X-A}u; j < ${X}u; j++) {
                  xIndices[j] = indices[j] * ${U0("uniforms.strides",`j - ${X-A}u`,A)}
                    + offsets[j - ${X-A}u] - ${U0("uniforms.pads","j - 2u",P)};
                  ${z}
              }
              ${G}

              output[global_idx] = value;
            }`}},VY=(J)=>`${J.format};${J.ceilMode};${J.autoPad};${J.kernelShape.length}`,ZB=(J)=>`${VY(J)};${J.countIncludePad}`,wB=(J)=>`${VY(J)};${J.storageOrder};${J.dilations}`,KY=(J)=>({format:J.format,autoPad:["NOTSET","VALID","SAME_UPPER","SAME_LOWER"][J.auto_pad],ceilMode:J.ceil_mode,kernelShape:J.kernel_shape,strides:J.strides,pads:J.pads}),MY=(J,Q,X,Y)=>{let[H,W]=jY(Q,Y,X),G=i("x",Q.dataType,Q.dims.length),j=G.type.value,N="value += x_val;",V="";H.countIncludePad?V+=`value /= ${j}(uniforms.kernelSize);`:V+=`value /= ${j}(i32(uniforms.kernelSize) - pad);`;let[L,B,U,E,R]=FY(W,H);L.push(...R0(Q.dims,W));let A=["rank"];return{name:J,shaderCache:{hint:`${Y.cacheKey};${U};${E};${R}`,inputDependencies:A},getRunData:()=>({outputs:[{dims:W,dataType:Q.dataType}],dispatchGroup:{x:Math.ceil(u.size(W)/64)},programUniforms:L}),getShaderSource:(P)=>NY(P,G,Q.dims.length,W.length,H,N,V,0,B,U,E,R)}},LR=(J)=>{let Q=J.count_include_pad!==0,X=KY(J);if(X.ceilMode!==0)throw Error("using ceil() in shape computation is not yet supported for AveragePool");let Y={countIncludePad:Q,...X,cacheKey:""};return{...Y,cacheKey:ZB(Y)}},UR=(J,Q)=>{c2(J.inputs),J.compute(MY("AveragePool",J.inputs[0],!1,Q))},BY={autoPad:"",ceilMode:0,countIncludePad:!1,kernelShape:[],strides:[],pads:[],storageOrder:0,dilations:[]},OR=(J)=>{let Q=J.format;return{format:Q,...BY,cacheKey:Q}},RR=(J,Q)=>{c2(J.inputs),J.compute(MY("GlobalAveragePool",J.inputs[0],!0,Q))},LY=(J,Q,X,Y)=>{let[H,W]=jY(Q,Y,X),G=`
      value = max(x_val, value);
    `,j="",N=i("x",Q.dataType,Q.dims.length),V=["rank"],[L,B,U,E,R]=FY(W,H);return L.push(...R0(Q.dims,W)),{name:J,shaderCache:{hint:`${Y.cacheKey};${U};${E};${R}`,inputDependencies:V},getRunData:()=>({outputs:[{dims:W,dataType:Q.dataType}],dispatchGroup:{x:Math.ceil(u.size(W)/64)},programUniforms:L}),getShaderSource:(A)=>NY(A,N,Q.dims.length,W.length,H,G,j,Q.dataType===10?-65504:-1e5,B,U,E,R)}},ER=(J,Q)=>{c2(J.inputs),J.compute(LY("MaxPool",J.inputs[0],!1,Q))},DR=(J)=>{let{storage_order:Q,dilations:X}=J,Y=KY(J);if(Q!==0)throw Error("column major storage order is not yet supported for MaxPool");if(Y.ceilMode!==0)throw Error("using ceil() in shape computation is not yet supported for MaxPool");let H={storageOrder:Q,dilations:X,...Y,cacheKey:""};return{...H,cacheKey:wB(H)}},AR=(J)=>{let Q=J.format;return{format:Q,...BY,cacheKey:Q}},zR=(J,Q)=>{c2(J.inputs),J.compute(LY("GlobalMaxPool",J.inputs[0],!0,Q))}}),jz=Q0(()=>{z0(),w0(),Q1(),I0(),kB=(J,Q)=>{if(J.length<2||J.length>3)throw Error("DequantizeLinear requires 2 or 3 inputs.");if(J.length===3&&J[1].dims===J[2].dims)throw Error("x-scale and x-zero-point must have the same shape.");if(J.length===3&&J[0].dataType!==J[2].dataType)throw Error("x and x-zero-point must have the same data type.");if(J[0].dataType===6&&J.length>2)throw Error("In the case of dequantizing int32 there is no zero point.");if(J[1].dims.length!==0&&J[1].dims.length!==1&&J[1].dims.length!==J[0].dims.length)throw Error("scale input must be a scalar, a 1D tensor, or have the same rank as the input tensor.");if(J.length>2){if(J[0].dataType!==J[2].dataType)throw Error("x and x-zero-point must have the same data type.");if(J[1].dims.length!==J[2].dims.length)throw Error("scale and zero-point inputs must have the same rank.");if(!J[1].dims.map((X,Y)=>X===J[2].dims[Y]).reduce((X,Y)=>X&&Y,!0))throw Error("scale and zero-point inputs must have the same shape.")}if(Q.blockSize>0){if(J[1].dims.length===0||J[1].dims.length===1&&J[1].dims[0]===1)throw Error("blockSize must be set only for block quantization.");if(!J[1].dims.map((H,W)=>W===Q.axis||H===J[0].dims[W]).reduce((H,W)=>H&&W,!0))throw Error("For block qunatization, scale input shape to match the input shape except for the axis");if(J[1].dims.length!==J[0].dims.length)throw Error("For block qunatization the scale input rank must be the same as the x rank.");let X=J[0].dims[Q.axis],Y=J[1].dims[Q.axis];if(Q.blockSize<Math.ceil(X/Y)||Q.blockSize>Math.ceil(X/(Y-1)-1))throw Error("blockSize must be with in the range [ceil(dI / Si), ceil(dI / (Si - 1) - 1)].")}},CB=(J,Q)=>{let X=u.normalizeAxis(Q.axis,J[0].dims.length),Y=J[0].dataType,H=Y===3,W=J[0].dims,G=J[1].dataType,j=u.size(W),N=Y===3||Y===2,V=N?[Math.ceil(u.size(J[0].dims)/4)]:J[0].dims,L=J[1].dims,B=J.length>2?J[2]:void 0,U=B?N?[Math.ceil(u.size(B.dims)/4)]:B.dims:void 0,E=L.length===0||L.length===1&&L[0]===1,R=E===!1&&L.length===1,A=e0(j),P=E&&(!N||A===4),z=P?A:1,D=P&&!N?A:1,S=i("input",N?12:Y,V.length,D),w=i("scale",G,L.length),k=B?i("zero_point",N?12:Y,U.length):void 0,I=B0("output",G,W.length,z),C=[S,w];k&&C.push(k);let T=[V,L];B&&T.push(U);let g=[{type:12,data:j/z},{type:12,data:X},{type:12,data:Q.blockSize},...R0(...T,W)],m=(l)=>{let t=[{name:"output_size",type:"u32"},{name:"axis",type:"u32"},{name:"block_size",type:"u32"}];return`
      ${l.registerUniforms(t).declareVariables(...C,I)}
      ${l.mainStart()}
          ${l.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let output_indices = ${I.offsetToIndices("global_idx")};

          // Set input x
          ${N?`
            let input = ${S.getByOffset("global_idx / 4")};
            let x_vec = ${H?"unpack4xI8(input)":"unpack4xU8(input)"};
            let x_value = ${z===1?"x_vec[global_idx % 4]":"x_vec"};`:`let x_value = ${S.getByOffset("global_idx")};`};

          // Set scale input
          ${E?`let scale_value= ${w.getByOffset("0")}`:R?`
            let scale_index = ${I.indicesGet("output_indices","uniforms.axis")};
            let scale_value= ${w.getByOffset("scale_index")};`:`
            var scale_indices: ${w.type.indices} = output_indices;
            let index = ${w.indicesGet("scale_indices","uniforms.axis")} / uniforms.block_size;
            ${w.indicesSet("scale_indices","uniforms.axis","index")};
            let scale_value= ${w.getByIndices("scale_indices")};`};

          // Set zero-point input
          ${k?E?N?`
                let zero_point_input = ${k.getByOffset("0")};
                let zero_point_vec =  ${H?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value= zero_point_vec[0]`:`let zero_point_value = ${k.getByOffset("0")}`:R?N?`
                let zero_point_index = ${I.indicesGet("output_indices","uniforms.axis")};
                let zero_point_input = ${k.getByOffset("zero_point_index / 4")};
                let zero_point_vec =  ${H?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_index % 4]`:`
                let zero_point_index = ${I.indicesGet("output_indices","uniforms.axis")};
                let zero_point_value = ${k.getByOffset("zero_point_index")};`:N?`
                let zero_point_offset = ${w.indicesToOffset("scale_indices")};
                let zero_point_input = ${k.getByOffset("zero_point_offset / 4")};
                let zero_point_vec = ${H?"unpack4xI8(zero_point_input)":"unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_offset % 4];`:`let zero_point_value = ${k.getByIndices("scale_indices")};`:`let zero_point_value = ${N?H?"i32":"u32":S.type.value}(0);`};
      // Compute and write output
      ${I.setByOffset("global_idx",`${I.type.value}(x_value - zero_point_value) * scale_value`)};
      }`};return{name:"DequantizeLinear",shaderCache:{hint:Q.cacheKey,inputDependencies:k?["rank","rank","rank"]:["rank","rank"]},getShaderSource:m,getRunData:()=>({outputs:[{dims:W,dataType:G}],dispatchGroup:{x:Math.ceil(j/z/64),y:1,z:1},programUniforms:g})}},$R=(J,Q)=>{kB(J.inputs,Q),J.compute(CB(J.inputs,Q))},PR=(J)=>d0({axis:J.axis,blockSize:J.blockSize})}),Fz=Q0(()=>{M6(),z0(),I0(),IB=(J,Q,X)=>{let Y=J===Q,H=J<Q&&X<0,W=J>Q&&X>0;if(Y||H||W)throw Error("Range these inputs' contents are invalid.")},_B=(J,Q,X,Y)=>{let H=Math.abs(Math.ceil((Q-J)/X)),W=[H],G=H,j=[{type:12,data:G},{type:Y,data:J},{type:Y,data:X},...R0(W)],N=(V)=>{let L=B0("output",Y,W.length),B=L.type.value,U=[{name:"outputSize",type:"u32"},{name:"start",type:B},{name:"delta",type:B}];return`
        ${V.registerUniforms(U).declareVariables(L)}
        ${V.mainStart()}
        ${V.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        output[global_idx] = uniforms.start + ${B}(global_idx) * uniforms.delta;
      }`};return{name:"Range",shaderCache:{hint:`${Y}`},getShaderSource:N,getRunData:()=>({outputs:[{dims:W,dataType:Y}],dispatchGroup:{x:Math.ceil(G/64)},programUniforms:j})}},SR=(J)=>{let Q=0,X=0,Y=0;J.inputs[0].dataType===6?(Q=J.inputs[0].getInt32Array()[0],X=J.inputs[1].getInt32Array()[0],Y=J.inputs[2].getInt32Array()[0]):J.inputs[0].dataType===1&&(Q=J.inputs[0].getFloat32Array()[0],X=J.inputs[1].getFloat32Array()[0],Y=J.inputs[2].getFloat32Array()[0]),i0.webgpu.validateInputContent&&IB(Q,X,Y),J.compute(_B(Q,X,Y,J.inputs[0].dataType),{inputs:[]})}}),Nz=Q0(()=>{z0(),w0(),Q1(),I0(),bB=(J,Q,X,Y)=>{if(J!=="none"&&Y!=="i32"&&Y!=="u32"&&Y!=="f32")throw Error(`Input ${Y} is not supported with reduction ${J}.`);let H=`{
                var oldValue = 0;
                loop {
                  let newValueF32 =`,W=`;
                  let newValue = bitcast<i32>(newValueF32);
                  let res = atomicCompareExchangeWeak(&${Q}, oldValue, newValue);
                  if res.exchanged {
                    break;
                  }
                  oldValue = res.old_value;
                }
              }`;switch(J){case"none":return`${Q}=${X};`;case"add":return Y==="i32"||Y==="u32"?`atomicAdd(&${Q}, bitcast<${Y}>(${X}));`:`
              ${H}bitcast<${Y}>(oldValue) + (${X})${W}`;case"max":return Y==="i32"||Y==="u32"?`atomicMax(&${Q}, bitcast<${Y}>(${X}));`:`
                ${H}max(bitcast<f32>(oldValue), (${X}))${W}`;case"min":return Y==="i32"||Y==="u32"?`atomicMin(&${Q}, bitcast<${Y}>(${X}));`:`${H}min(bitcast<${Y}>(oldValue), (${X}))${W}`;case"mul":return`${H}(bitcast<${Y}>(oldValue) * (${X}))${W}`;default:throw Error(`Reduction ${J} is not supported.`)}},vB=(J,Q)=>{let X=J[0].dims,Y=J[1].dims,H=X,W=1,G=Math.ceil(u.size(Y)/W),j=Y[Y.length-1],N=u.sizeFromDimension(X,j),V=[{type:12,data:G},{type:12,data:j},{type:12,data:N},...R0(J[1].dims,J[2].dims,H)],L=(B)=>{let U=i("indices",J[1].dataType,J[1].dims.length),E=i("updates",J[2].dataType,J[2].dims.length,W),R=Q.reduction!=="none"&&Q.reduction!==""?YU("output",J[0].dataType,H.length):B0("output",J[0].dataType,H.length,W);return`
      ${B.registerUniform("output_size","u32").registerUniform("last_index_dimension","u32").registerUniform("num_updates_elements","u32").declareVariables(U,E,R)}
      ${B.mainStart()}
        ${B.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
  var hasDuplicates = false;
  if (${Q.reduction==="none"}) {
    let n = ${u.size(Y)};
    for (var i = 0; i < n; i = i + 1) {
      for (var j = i + 1; j < n; j = j + 1) {
        var index_i = i32(indices[i].x);
        var index_j = i32(indices[j].x);
        if (index_i == index_j) {
          hasDuplicates = true;
          break;
        }
      }
      if (hasDuplicates) {
        break;
      }
    }
  }

  var data_offset = 0u;
  var indices_start = uniforms.last_index_dimension * global_idx;
  if (${Q.reduction==="none"} && hasDuplicates) {
    if (global_idx != 0u) {
      return;
    }
    indices_start = 0u;
  }
  let indices_end = indices_start + uniforms.last_index_dimension;
  for (var i = indices_start; i < indices_end; i++) {
    var index = i32(indices[i].x);
    ${J[0].dims.length===1?`
    let element_count_dim = uniforms.output_strides;
    let dim_value = uniforms.output_shape;`:`
    let element_count_dim = uniforms.output_strides[i - indices_start];
    let dim_value = uniforms.output_shape[i - indices_start + uniforms.last_index_dimension];`}
    if (index >= 0) {
      if (index >= i32(dim_value)) {
        index = i32(dim_value - 1);
      }
    } else {
      if (index < -i32(dim_value)) {
        index = 0;
      } else {
        index += i32(dim_value);
      }
    }
    data_offset += u32((u32(index) * element_count_dim));
  }

  for (var i = 0u; i < uniforms.num_updates_elements; i++) {
    let value = updates[uniforms.num_updates_elements * global_idx + i];
    ${bB(Q.reduction,"output[data_offset + i]","value",R.type.value)}
  }

      }`};return{name:"ScatterND",shaderCache:{hint:`${Q.cacheKey}_${Q.reduction}`,inputDependencies:["rank","rank"]},getRunData:()=>({outputs:[{dims:H,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(G/64)},programUniforms:V}),getShaderSource:L}},ZR=(J)=>d0({reduction:J.reduction}),wR=(J,Q)=>{J.compute(vB(J.inputs,Q),{inputs:[J.inputs[1],J.inputs[2]],outputs:[]})}}),Vz=Q0(()=>{z0(),w0(),Q1(),I0(),TB=(J,Q)=>{if(J.every((X)=>X>0||(()=>{throw Error("Resize requires scales input values to be positive")})),J.length>0){if(Q.mode==="linear"){if(!(J.length===2||J.length===3||J.length===4&&J[0]===1&&J[1]===1||J.length===4&&J[0]===1&&J[3]===1||J.length===5&&J[0]===1&&J[1]===1))throw Error(`For linear mode, Resize requires scales to be 2D, 3D, 4D with either two outermost or one innermost and
            one outermost scale values equal to 1, or 5D with two outermost scale values equal to 1`)}else if(Q.mode==="cubic"&&!(J.length===2||J.length===4&&J[0]===1&&J[1]===1||J.length===4&&J[0]===1&&J[3]===1))throw Error("Resize requires scales input size to be 2 or 4 for cubic mode")}},xB=(J,Q,X)=>{Q.every((H)=>H>=0&&H<X||(()=>{throw Error("Resize requires axes input values to be positive and less than rank")}));let Y=Array(X).fill(1);return Q.forEach((H,W)=>Y[H]=J[W]),Y},fB=(J,Q,X,Y,H,W)=>{let[G,j,N]=X>10?[1,2,3]:[-1,J.length>1?1:-1,-1],V=J[0].dims.length;if(G>0&&J.length>G&&J[G].dims.length>0)J[G].getFloat32Array().forEach((L)=>W.push(L));else if(Q.coordinateTransformMode==="tf_crop_and_resize")throw Error("Resize requires RoI input to be specified when coordinateTransformMode is tfCropAndResize");if(j>0&&J.length>j&&J[j].dims.length===1&&J[j].dims[0]>0){if(J[j].getFloat32Array().forEach((L)=>Y.push(L)),Y.length!==0&&Y.length!==V&&X>=18&&Y.length!==Q.axes.length)throw Error("Resize requires scales input size to be same as input rank or axes size for opset 18 and up");TB(Y,Q),Q.axes.length>0&&xB(Y,Q.axes,V).forEach((L,B)=>Y[B]=L)}if(N>0&&J.length>N&&J[N].dims.length===1&&J[N].dims[0]>0&&(J[N].getBigInt64Array().forEach((L)=>H.push(Number(L))),H.length!==0&&H.length!==V&&X>=18&&H.length!==Q.axes.length))throw Error("Resize requires sizes input size to be same as input rank or axes size for opset 18 and up");if(Q.axes.length>0){if(Y.length!==0&&Y.length!==Q.axes.length)throw Error('Resize requires "scales" input size to be of axes rank when axes attributes is specified');if(H.length!==0&&H.length!==Q.axes.length)throw Error('Resize requires "sizes" input size to be of rank axes rank when axes attributes is specified')}if(typeof Y<"u"&&typeof H<"u"&&Y.length>0&&H.length>V)throw Error("Resize requires only of scales or sizes to be specified")},UY=(J,Q,X,Y)=>`
  // The whole part and the fractional part are calculated separately due to inaccuracy of floating
  // point division. As an example, f32(21) / f32(7) may evaluate to 2.99... instead of 3, causing an
  // offset-by-one error later in floor().
  let big = (${J}) * (${Q});
  let whole = ${Y}(big / (${X}));
  let fract = ${Y}(big % (${X})) / ${Y}(${X});
  return whole + fract;
`,hB=(J,Q)=>`fn getOriginalCoordinateFromResizedCoordinate(xResized: u32, xScale: f32, lengthResized: u32,
     lengthOriginal: u32, roiStart: f32, roiEnd: f32) -> ${Q} { `+(()=>{switch(J){case"asymmetric":return`
          if (xScale < 1.0 || floor(xScale) != xScale) {
            return ${Q}(xResized) / ${Q}(xScale);
          } else {
            ${UY("xResized","lengthOriginal","lengthResized",Q)}
          }
        `;case"pytorch_half_pixel":return`if (lengthResized > 1) {
                    return (${Q}(xResized) + 0.5) / ${Q}(xScale) - 0.5;
                  } else {
                    return 0.0;
                  }`;case"tf_half_pixel_for_nn":return`return (${Q}(xResized) + 0.5) / ${Q}(xScale);`;case"align_corners":return`if (lengthResized == 1) {
                    return 0.0;
                  } else {
                    ${UY("xResized","lengthOriginal - 1","lengthResized - 1",Q)}
                  }`;case"tf_crop_and_resize":return`if (lengthResized > 1) {
                    return ${Q}(roiStart) * ${Q}(lengthOriginal - 1) +
                        (${Q}(xResized) * ${Q}(roiEnd - roiStart) * ${Q}(lengthOriginal - 1)) /
                        ${Q}(lengthResized - 1);
                  } else {
                    return 0.5 * ${Q}(roiStart + roiEnd) * ${Q}(lengthOriginal - 1);
                  }`;case"half_pixel_symmetric":return`const outputWidth = ${Q}xScale * ${Q}(lengthResized);
                  const adjustment = ${Q}(lengthResized) / outputWidth;
                  const center = ${Q}(lengthOriginal) / 2;
                  const offset = center * (1 - adjustment);
                  return offset + ((${Q}(xResized) + 0.5) / ${Q}(xScale)) - 0.5;`;case"half_pixel":return`return ((${Q}(xResized) + 0.5) / ${Q}(xScale)) - 0.5;`;default:throw Error(`Coordinate transform mode ${J} is not supported`)}})()+"}",yB=(J,Q,X)=>`fn getNearestPixelFromOriginal(xOriginal: ${X}, isDownSample: bool) -> ${X} {`+(()=>{switch(J){case"round_prefer_ceil":return"if (fract(xOriginal) == 0.5) {             return ceil(xOriginal);           } else {             return round(xOriginal);           }";case"floor":return"return floor(xOriginal);";case"ceil":return"return ceil(xOriginal);";case"round_prefer_floor":return"if (fract(xOriginal) == 0.5) {                     return floor(xOriginal);                   } else {                     return round(xOriginal);                   }";case"simple":default:if(Q<11)return"if (isDownSample)                     {                       return ceil(xOriginal);                     } else {                       return xOriginal;                     }";throw Error(`Nearest mode ${J} is not supported`)}})()+"}",gB=(J,Q,X)=>{let Y=Array(X).fill(0).concat(Array(X).fill(1)),H=J.length===0?Y:J.slice();return Q.length>0?(Q.forEach((W,G)=>{Y[W]=H[G],Y[G+X]=H[Q.length+G]}),Y):H},lB=(J,Q,X,Y)=>{let H=[];if(X.length>0)if(Y.length>0){if(J.forEach((W)=>H.push(W)),Math.max(...Y)>J.length)throw Error("axes is out of bound");Y.forEach((W,G)=>H[W]=X[G])}else X.forEach((W)=>H.push(W));else{if(Q.length===0)throw Error("Resize requires either scales or sizes.");H=J.map((W,G)=>Math.round(W*Q[G]))}return H},mB=(J,Q,X)=>{let Y=(()=>{switch(X.keepAspectRatioPolicy){case"not_larger":return X.axes.length>0?Math.min(...X.axes.map((W)=>Q[W]),Number.MAX_VALUE):Math.min(...Q,Number.MAX_VALUE);case"not_smaller":return X.axes.length>0?Math.max(...X.axes.map((W)=>Q[W]),Number.MIN_VALUE):Math.max(...Q,Number.MIN_VALUE);default:throw Error(`Keep aspect ratio policy ${X.keepAspectRatioPolicy} is not supported`)}})();Q.fill(1,0,Q.length);let H=J.slice();return X.axes.length>0?(X.axes.forEach((W)=>Q[W]=Y),X.axes.forEach((W)=>H[W]=Math.round(J[W]*Q[W]))):(Q.fill(Y,0,Q.length),H.forEach((W,G)=>H[G]=Math.round(W*Q[G]))),H},pB=(J,Q,X,Y,H)=>`
    fn calculateOriginalIndicesFromOutputIndices(output_indices: ${J.type.indices}) -> array<${J.type.value}, ${X.length}> {
      var original_indices: array<${J.type.value}, ${X.length}>;
      for (var i:u32 = 0; i < ${X.length}; i++) {
        var output_index = ${J.indicesGet("output_indices","i")};
        var scale = ${U0("uniforms.scales","i",Y)};
        var roi_low = ${U0("uniforms.roi","i",H)};
        var roi_hi = ${U0("uniforms.roi",`i + ${Q.length}`,H)};
        if (scale == 1.0) {
          original_indices[i] = ${J.type.value}(output_index);
        } else {
          var input_shape_i = ${U0("uniforms.input_shape","i",Q.length)};
          var output_shape_i = ${U0("uniforms.output_shape","i",X.length)};
          original_indices[i] = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                           input_shape_i, roi_low, roi_hi);
        }
      }
      return original_indices;
    }`,cB=(J,Q,X,Y,H,W,G)=>`
    fn calculateInputIndicesFromOutputIndices(output_indices: ${Q.type.indices}) -> ${J.type.indices} {
      var input_indices: ${J.type.indices};
      for (var i:u32 = 0; i < ${Y.length}; i++) {
        var output_index = ${Q.indicesGet("output_indices","i")};
        var input_index: u32;
        var scale = ${U0("uniforms.scales","i",H)};
        if (scale == 1.0) {
          input_index = output_index;
        } else {
          var roi_low = ${U0("uniforms.roi","i",W)};
          var roi_hi = ${U0("uniforms.roi",`i + ${X.length}`,W)};
          var input_shape_i = ${U0("uniforms.input_shape","i",X.length)};
          var output_shape_i = ${U0("uniforms.output_shape","i",Y.length)};
          var original_idx = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                        input_shape_i, roi_low, roi_hi);
          if (!${G} || (original_idx >= 0 && original_idx < ${Q.type.value}(input_shape_i))) {
            if (original_idx < 0) {
              input_index = 0;
            } else if (original_idx > ${Q.type.value}(input_shape_i - 1)) {
              input_index = input_shape_i - 1;
            } else {
              input_index = u32(getNearestPixelFromOriginal(original_idx, scale < 1));
            }
          } else {
            input_index = u32(original_idx);
          }
        }
        ${J.indicesSet("input_indices","i","input_index")}
      }
      return input_indices;
    }`,dB=(J,Q)=>`
    fn checkInputIndices(input_indices: ${J.type.indices}) -> bool {
      for (var i:u32 = 0; i < ${Q.length}; i++) {
        var input_index = ${J.indicesGet("input_indices","i")};
        if (input_index < 0 || input_index >= ${U0("uniforms.input_shape","i",Q.length)}) {
          return false;
        }
      }
      return true;
    }`,OY=(J,Q,X,Y)=>J.rank>Y?`
    ${J.indicesSet("input_indices",Q,"channel")};
    ${J.indicesSet("input_indices",X,"batch")};
`:"",uB=(J,Q,X,Y,H)=>{let[W,G,j,N]=X.length===2?[-1,0,1,-1]:[0,2,3,1],V=J.type.value;return`
    fn getInputValue(batch: u32, channel: u32, row: u32, col: u32) -> ${V} {
      var input_indices: ${J.type.indices};
      ${J.indicesSet("input_indices",G,`max(0, min(row, ${X[G]} - 1))`)};
      ${J.indicesSet("input_indices",j,`max(0, min(col, ${X[j]} - 1))`)};
      ${OY(J,N,W,2)}
      return ${J.getByIndices("input_indices")};
    }

    fn bilinearInterpolation(output_indices: ${Q.type.indices}) -> ${V} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var row:${V} = originalIndices[${G}];
      var col:${V} = originalIndices[${j}];
      ${Y?`if (row < 0 || row > (${X[G]} - 1) || col < 0 || col > (${X[j]} - 1)) {
        return ${H};
      }`:""};
      row = max(0, min(row, ${X[G]} - 1));
      col = max(0, min(col, ${X[j]} - 1));
      var row1: u32 = u32(row);
      var col1: u32 = u32(col);
      var row2: u32 = u32(row + 1);
      var col2: u32 = u32(col + 1);
      var channel: u32 = ${X.length>2?`u32(originalIndices[${N}])`:"0"};
      var batch: u32 =  ${X.length>2?`u32(originalIndices[${W}])`:"0"};
      var x11: ${V} = getInputValue(batch, channel, row1, col1);
      var x12: ${V} = getInputValue(batch, channel, row1, col2);
      var x21: ${V} = getInputValue(batch, channel, row2, col1);
      var x22: ${V} = getInputValue(batch, channel, row2, col2);
      var dx1: ${V} = abs(row - ${V}(row1));
      var dx2: ${V} = abs(${V}(row2) - row);
      var dy1: ${V} = abs(col - ${V}(col1));
      var dy2: ${V} = abs(${V}(col2) - col);
      if (row1 == row2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (col1 == col2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      return (x11 * dx2 * dy2 + x12 * dx2 * dy1 + x21 * dx1 * dy2 + x22 * dx1 * dy1);
    }`},oB=(J,Q,X,Y,H,W,G,j,N,V)=>{let L=X.length===2,B=!0,[U,E]=L?[0,1]:B?[2,3]:[1,2],R=J.type.value,A=(P)=>{let z=P===U?"row":"col";return`
      fn ${z}CubicInterpolation(input_indices: ${J.type.indices}, output_indices: ${Q.type.indices}) -> ${R} {
        var output_index = ${Q.indicesGet("output_indices",P)};
        var originalIdx: ${R} = getOriginalCoordinateFromResizedCoordinate(output_index, ${H[P]},
        ${Y[P]}, ${X[P]}, ${W[P]}, ${W[P]} + ${X.length});
        var fractOriginalIdx: ${R} = originalIdx - floor(originalIdx);
        var coefs = getCubicInterpolationCoefs(fractOriginalIdx);

        if (${j} && (originalIdx < 0 || originalIdx > (${X[P]} - 1))) {
          return ${N};
        }
        var data: array<${R}, 4> = array<${R}, 4>(0.0, 0.0, 0.0, 0.0);
        for (var i: i32 = -1; i < 3; i++) {
          var ${z}: ${R} = originalIdx + ${R}(i);
          if (${z} < 0 || ${z} >= ${X[P]}) {
            ${V?`coefs[i + 1] = 0.0;
                        continue;`:j?`return ${N};`:`${z} = max(0, min(${z}, ${X[P]} - 1));`};
          }
        var input_indices_copy: ${J.type.indices} = input_indices;
          ${J.indicesSet("input_indices_copy",P,`u32(${z})`)};
          data[i + 1] = ${P===U?J.getByIndices("input_indices_copy"):"rowCubicInterpolation(input_indices_copy, output_indices)"};
        }
        return cubicInterpolation1D(data, coefs);
      }`};return`
    ${A(U)};
    ${A(E)};
  fn getCubicInterpolationCoefs(s: ${R}) -> array<${R}, 4> {
    var absS = abs(s);
    var coeffs: array<${R}, 4> = array<${R}, 4>(0.0, 0.0, 0.0, 0.0);
    var oneMinusAbsS: ${R} = 1.0 - absS;
    var twoMinusAbsS: ${R} = 2.0 - absS;
    var onePlusAbsS: ${R} = 1.0 + absS;
    coeffs[0] = ((${G} * onePlusAbsS - 5 * ${G}) * onePlusAbsS + 8 * ${G}) * onePlusAbsS - 4 * ${G};
    coeffs[1] = ((${G} + 2) * absS - (${G} + 3)) * absS * absS + 1;
    coeffs[2] = ((${G} + 2) * oneMinusAbsS - (${G} + 3)) * oneMinusAbsS * oneMinusAbsS + 1;
    coeffs[3] = ((${G} * twoMinusAbsS - 5 * ${G}) * twoMinusAbsS + 8 * ${G}) * twoMinusAbsS - 4 * ${G};
    return coeffs;
  }

  fn cubicInterpolation1D(x: array<${R}, 4>, coefs: array<${R}, 4>) -> ${R} {
    var coefsSum: ${R} = coefs[0] + coefs[1] + coefs[2] + coefs[3];
    return (x[0] * coefs[0] + x[1] * coefs[1]+ x[2] * coefs[2]+ x[3] * coefs[3]) / coefsSum;
  }

  fn bicubicInterpolation(output_indices: ${Q.type.indices}) -> ${R} {
    var input_indices: ${J.type.indices} = output_indices;
    return colCubicInterpolation(input_indices, output_indices);
  }
    `},sB=(J,Q,X,Y,H)=>{let[W,G,j,N,V]=X.length===3?[-1,0,1,2,-1]:[0,2,3,4,1],L=J.type.value;return`
    fn getInputValue(batch: u32, channel: u32, depth:u32, height: u32, width: u32) -> ${L} {
      var input_indices: ${J.type.indices};
      ${J.indicesSet("input_indices",G,`max(0, min(depth, ${X[G]} - 1))`)};
      ${J.indicesSet("input_indices",j,`max(0, min(height, ${X[j]} - 1))`)};
      ${J.indicesSet("input_indices",N,`max(0, min(width, ${X[N]} - 1))`)};
      ${OY(J,V,W,3)}
      return ${J.getByIndices("input_indices")};
    }

    fn trilinearInterpolation(output_indices: ${Q.type.indices}) -> ${L} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var depth:${L} = originalIndices[${G}];
      var height:${L} = originalIndices[${j}];
      var width:${L} = originalIndices[${N}];
      ${Y?`if (depth < 0 || depth > (${X[G]} - 1) || height < 0 || height > (${X[j]} - 1) || width < 0 || (width > ${X[N]} - 1)) {
      return ${H};
        }`:""};

    depth = max(0, min(depth, ${X[G]} - 1));
      height = max(0, min(height, ${X[j]} - 1));
      width = max(0, min(width, ${X[N]} - 1));
      var depth1: u32 = u32(depth);
      var height1: u32 = u32(height);
      var width1: u32 = u32(width);
      var depth2: u32 = u32(depth + 1);
      var height2: u32 = u32(height + 1);
      var width2: u32 = u32(width + 1);
      var channel: u32 = ${X.length>3?`u32(originalIndices[${V}])`:"0"};
      var batch: u32 =  ${X.length>3?`u32(originalIndices[${W}])`:"0"};

      var x111: ${L} = getInputValue(batch, channel, depth1, height1, width1);
      var x112: ${L} = getInputValue(batch, channel, depth1, height1, width2);
      var x121: ${L} = getInputValue(batch, channel, depth1, height2, width1);
      var x122: ${L} = getInputValue(batch, channel, depth1, height2, width2);
      var x211: ${L} = getInputValue(batch, channel, depth2, height1, width1);
      var x212: ${L} = getInputValue(batch, channel, depth2, height1, width2);
      var x221: ${L} = getInputValue(batch, channel, depth2, height2, width1);
      var x222: ${L} = getInputValue(batch, channel, depth2, height2, width2);
      var dx1: ${L} = abs(depth - ${L}(depth1));
      var dx2: ${L} = abs(${L}(depth2) - depth);
      var dy1: ${L} = abs(height - ${L}(height1));
      var dy2: ${L} = abs(${L}(height2) - height);
      var dz1: ${L} = abs(width - ${L}(width1));
      var dz2: ${L} = abs(${L}(width2) - width);
      if (depth1 == depth2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (height1 == height2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      if (width1 == width2) {
        dz1 = 0.5;
        dz2 = 0.5;
      }
      return (x111 * dx2 * dy2 * dz2 + x112 * dx2 * dy2 * dz1 + x121 * dx2 * dy1 *dz2 + x122 * dx2 * dy1 * dz1 +
              x211 * dx1 * dy2 * dz2 + x212 * dx1 * dy2 * dz1 + x221 * dx1 * dy1 *dz2 + x222 * dx1 * dy1 * dz1);
    }`},aB=(J,Q,X,Y,H,W)=>{let G=J.dims,j=gB(W,Q.axes,G.length),N=lB(G,Y,H,Q.axes),V=Y.slice();Y.length===0&&(V=G.map((D,S)=>D===0?1:N[S]/D),Q.keepAspectRatioPolicy!=="stretch"&&(N=mB(G,V,Q)));let L=B0("output",J.dataType,N.length),B=i("input",J.dataType,G.length),U=u.size(N),E=G.length===N.length&&G.every((D,S)=>D===N[S]),R=Q.coordinateTransformMode==="tf_crop_and_resize",A=Q.extrapolationValue,P=B.type.value,z=(D)=>`
      ${E?"":`
      ${hB(Q.coordinateTransformMode,P)};
      ${(()=>{switch(Q.mode){case"nearest":return`
              ${dB(B,G)};
              ${yB(Q.nearestMode,X,P)};
              ${cB(B,L,G,N,V.length,j.length,R)};
              `;case"linear":return`
              ${pB(L,G,N,V.length,j.length)};
              ${(()=>{if(G.length===2||G.length===4)return`${uB(B,L,G,R,A)}`;if(G.length===3||G.length===5)return`${sB(B,L,G,R,A)}`;throw Error("Linear mode only supports input dims 2, 3, 4 and 5 are supported in linear mode.")})()};
            `;case"cubic":return`
            ${(()=>{if(G.length===2||G.length===4)return`${oB(B,L,G,N,V,j,Q.cubicCoeffA,R,Q.extrapolationValue,Q.excludeOutside)}`;throw Error("Cubic mode only supports input dims 2 and 4 are supported in linear mode.")})()};
            `;default:throw Error("Invalid resize mode")}})()};
      `}
      ${D.registerUniform("output_size","u32").registerUniform("scales","f32",V.length).registerUniform("roi","f32",j.length).declareVariables(B,L)}
      ${D.mainStart()}
        ${D.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
        ${E?"output[global_idx] = input[global_idx];":`
        let output_indices = ${L.offsetToIndices("global_idx")};
        var input_indices: ${B.type.indices};
        ${(()=>{switch(Q.mode){case"nearest":return`input_indices = calculateInputIndicesFromOutputIndices(output_indices);
                if (checkInputIndices(input_indices)) {
                  output[global_idx] = ${B.getByIndices("input_indices")};
                } else {
                  output[global_idx] = ${Q.extrapolationValue};
                }`;case"linear":return`output[global_idx] = ${G.length===2||G.length===4?"bilinearInterpolation":"trilinearInterpolation"}(output_indices);`;case"cubic":return"output[global_idx] = bicubicInterpolation(output_indices);";default:throw Error(`Unsupported resize mode: ${Q.mode}`)}})()};
`}
      }`;return{name:"Resize",shaderCache:{hint:`${Q.cacheKey}|${X}|${V.length>0?Q.mode==="cubic"?V:V.length:""}|${H.length>0?H:""}|${j.length>0?j:""}|${E}|${Q.mode==="nearest"?G.length:G}`,inputDependencies:["rank"]},getShaderSource:z,getRunData:()=>({outputs:[{dims:N,dataType:J.dataType}],dispatchGroup:{x:Math.ceil(U/64)},programUniforms:[{type:12,data:U},{type:1,data:V},{type:1,data:j},...R0(G,N)]})}},iB=(J)=>{let Q=J.customDataBuffer;return new Uint32Array(Q,Q.byteOffset,1)[0]},kR=(J,Q)=>{let X=[],Y=[],H=[],W=iB(J);if(Q.antialias!==0)throw Error("Only default value (0) for Antialias attribute is supported");fB(J.inputs,Q,W,X,Y,H),J.compute(aB(J.inputs[0],Q,W,X,Y,H),{inputs:[0]})},CR=(J)=>{let{antialias:Q,axes:X,coordinateTransformMode:Y,cubicCoeffA:H}=J,W=J.excludeOutside!==0,G=J.extrapolationValue,j=J.keepAspectRatioPolicy,N=J.mode,V=J.nearestMode===""?"simple":J.nearestMode;return d0({antialias:Q,axes:X,coordinateTransformMode:Y,cubicCoeffA:H,excludeOutside:W,extrapolationValue:G,keepAspectRatioPolicy:j,mode:N,nearestMode:V})}}),Kz=Q0(()=>{z0(),w0(),Q1(),I0(),nB=(J,Q)=>{let[X,Y,H,W]=J,{numHeads:G,rotaryEmbeddingDim:j}=Q;if(X.dims.length!==3&&X.dims.length!==4)throw Error(`Input 'x' is expected to have 3 or 4 dimensions, got ${X.dims.length}`);if(!u.areEqual(Y.dims,[])&&!u.areEqual(Y.dims,[1])&&Y.dims.length!==2)throw Error(`Input 'position_ids' is expected to have 0, 1, or 2 dimensions, got ${Y.dims.length}`);if(H.dims.length!==2)throw Error(`Input 'cos_cache' is expected to have 2 dimensions, got ${H.dims.length}`);if(W.dims.length!==2)throw Error(`Input 'sin_cache' is expected to have 2 dimensions, got ${W.dims.length}`);if(!u.areEqual(H.dims,W.dims))throw Error("Inputs 'cos_cache' and 'sin_cache' are expected to have the same shape");if(j>0&&G===0)throw Error("num_heads must be provided if rotary_embedding_dim is specified");let N=X.dims[0],V=X.dims[X.dims.length-2],L=H.dims[0],B=u.sizeFromDimension(X.dims,1)/V,U=j===0?H.dims[1]*2:B/G;if(j>U)throw Error("rotary_embedding_dim must be less than or equal to head_size");if(Y.dims.length===2){if(N!==Y.dims[0])throw Error(`Input 'position_ids' dimension 0 should be of size batch_size, got ${Y.dims[0]}`);if(V!==Y.dims[1])throw Error(`Input 'position_ids' dimension 1 should be of size sequence_length, got ${Y.dims[1]}`)}if(U/2!==H.dims[1]&&j/2!==H.dims[1])throw Error(`Input 'cos_cache' dimension 1 should be same as head_size / 2 or rotary_embedding_dim / 2, got ${H.dims[1]}`);if(V>L)throw Error("Updating cos_cache and sin_cache in RotaryEmbedding is not currently supported")},rB=(J,Q)=>{let{interleaved:X,numHeads:Y,rotaryEmbeddingDim:H,scale:W}=Q,G=J[0].dims[0],j=u.sizeFromDimension(J[0].dims,1),N=J[0].dims[J[0].dims.length-2],V=j/N,L=J[2].dims[1],B=H===0?L*2:V/Y,U=[G,N,V/B,B-L],E=u.computeStrides(U),R=[{type:1,data:W},{type:12,data:U},{type:12,data:E},...J[0].dims.length===3?[{type:12,data:[j,V,B,1]}]:[],...J[0].dims.length===4?[{type:12,data:[j,B,N*B,1]}]:[],...R0(J[0].dims,J[1].dims,J[2].dims,J[3].dims,J[0].dims)],A=(P)=>{let z=i("input",J[0].dataType,J[0].dims.length),D=i("position_ids",J[1].dataType,J[1].dims.length),S=i("cos_cache",J[2].dataType,J[2].dims.length),w=i("sin_cache",J[3].dataType,J[3].dims.length),k=B0("output",J[0].dataType,J[0].dims.length);return P.registerUniforms([{name:"scale",type:"f32"},{name:"global_shape",type:"u32",length:U.length},{name:"global_strides",type:"u32",length:E.length},{name:"input_output_strides",type:"u32",length:E.length}]),`
        ${P.declareVariables(z,D,S,w,k)}

        ${P.mainStart(W7)}
          let half_rotary_emb_dim = uniforms.${S.name}_shape[1];
          let bsnh = global_idx / uniforms.global_strides % uniforms.global_shape;
          let size = uniforms.global_shape[0] * uniforms.global_strides[0];
          ${P.guardAgainstOutOfBoundsWorkgroupSizes("size")}

          if (bsnh[3] < half_rotary_emb_dim) {
            let position_ids_idx =
                ${D.broadcastedIndicesToOffset("bsnh.xy",B0("",D.type.tensor,2))};
            let position_id =
                u32(${D.getByOffset("position_ids_idx")}) + select(0, bsnh[1], position_ids_idx == 0);
            let i = dot(bsnh, uniforms.input_output_strides) + select(0, bsnh[3], ${X});
            let j = i + select(half_rotary_emb_dim, 1, ${X});
            let re = ${z.getByOffset("i")} * ${S.get("position_id","bsnh[3]")} -
                ${z.getByOffset("j")} * ${w.get("position_id","bsnh[3]")};
            ${k.setByOffset("i","re")}
            let im = ${z.getByOffset("i")} * ${w.get("position_id","bsnh[3]")} +
                ${z.getByOffset("j")} * ${S.get("position_id","bsnh[3]")};
            ${k.setByOffset("j","im")}
          } else {
            let k = dot(bsnh, uniforms.input_output_strides) + half_rotary_emb_dim;
            ${k.setByOffset("k",z.getByOffset("k"))}
          }
        }`};return{name:"RotaryEmbedding",shaderCache:{hint:d0({interleaved:X}).cacheKey,inputDependencies:["rank","rank","rank","rank"]},getShaderSource:A,getRunData:()=>({outputs:[{dims:J[0].dims,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(u.size(U)/W7)},programUniforms:R})}},IR=(J,Q)=>{nB(J.inputs,Q),J.compute(rB(J.inputs,Q))}}),Mz=Q0(()=>{z0(),w0(),I0(),tB=(J)=>{if(!J||J.length<3)throw Error("layerNorm requires at least 3 inputs.");let Q=J[0],X=J[1],Y=J[2];if(Q.dataType!==X.dataType||Q.dataType!==Y.dataType)throw Error("All inputs must have the same data type");if(Q.dims.length!==3&&Q.dims.length!==2)throw Error("Input must be 2D or 3D");if(X.dims.length!==3&&X.dims.length!==2)throw Error("Skip must be 2D or 3D");let H=Q.dims[Q.dims.length-1],W=Q.dims[Q.dims.length-2];if(X.dims[X.dims.length-1]!==H)throw Error("Skip must have the same hidden size as input");if(X.dims[X.dims.length-2]!==W)throw Error("Skip must have the same sequence length as input");if(Y.dims.length!==1)throw Error("Gamma must be 1D");if(Y.dims[Y.dims.length-1]!==H)throw Error("Gamma must have the same hidden size as input");if(J.length>3){let G=J[3];if(G.dims.length!==1)throw Error("Beta must be 1D");if(G.dims[G.dims.length-1]!==H)throw Error("Beta must have the same hidden size as input")}if(J.length>4){let G=J[4];if(G.dims.length!==1)throw Error("Bias must be 1D");if(G.dims[G.dims.length-1]!==H)throw Error("Bias must have the same hidden size as input")}},eB=(J,Q,X,Y)=>{let H=Q.simplified,W=J[0].dims,G=u.size(W),j=W,N=G,V=W.slice(-1)[0],L=Y?W.slice(0,-1).concat(1):[],B=!H&&J.length>3,U=J.length>4,E=Y&&X>1,R=Y&&X>2,A=X>3,P=64,z=e0(V),D=[{type:12,data:N},{type:12,data:z},{type:12,data:V},{type:1,data:Q.epsilon}],S=(k)=>{let I=[{name:"output_size",type:"u32"},{name:"components",type:"u32"},{name:"hidden_size",type:"u32"},{name:"epsilon",type:"f32"}],C=[i("x",J[0].dataType,J[0].dims,z),i("skip",J[1].dataType,J[1].dims,z),i("gamma",J[2].dataType,J[2].dims,z)];B&&C.push(i("beta",J[3].dataType,J[3].dims,z)),U&&C.push(i("bias",J[4].dataType,J[4].dims,z)),C.push(B0("output",J[0].dataType,j,z)),E&&C.push(B0("mean_output",1,L)),R&&C.push(B0("inv_std_output",1,L)),A&&C.push(B0("input_skip_bias_sum",J[0].dataType,j,z));let T=K1(J[0].dataType),g=K1(1,z);return`

      ${k.registerUniforms(I).declareVariables(...C)}
      var<workgroup> sum_shared : array<${g}, ${P}>;
      var<workgroup> sum_squared_shared : array<${g}, ${P}>;

      ${k.mainStart([P,1,1])}
        let ix = local_id.x;
        let iy = global_id.x / ${P};

        let hidden_size_vectorized: u32 = uniforms.hidden_size / uniforms.components;
        var stride = hidden_size_vectorized / ${P};
        let offset = ix * stride + iy * hidden_size_vectorized;
        let offset1d = stride * ix;
        if (ix == ${P-1}) {
          stride = hidden_size_vectorized - stride * ix;
        }
        for (var i: u32 = 0; i < stride; i++) {
          let skip_value = skip[offset + i];
          let bias_value = ${U?"bias[offset1d + i]":T+"(0.0)"};
          let input_value = x[offset + i];
          let value = input_value + skip_value + bias_value;
          ${A?"input_skip_bias_sum[offset + i] = value;":""}
          output[offset + i] = value;
          let f32_value = ${H7(T,z,"value")};
          sum_shared[ix] += f32_value;
          sum_squared_shared[ix] += f32_value * f32_value;
        }
        workgroupBarrier();

        var reduce_size : u32 = ${P};
        for (var curr_size = reduce_size >> 1;  curr_size > 0; curr_size = reduce_size >> 1) {
          reduce_size = curr_size + (reduce_size & 1);
          if (ix < curr_size) {
            sum_shared[ix] += sum_shared[ix + reduce_size];
            sum_squared_shared[ix] += sum_squared_shared[ix + reduce_size];
          }
          workgroupBarrier();
        }

        let sum = sum_shared[0];
        let square_sum = sum_squared_shared[0];
        let mean = ${i6("sum",z)} / f32(uniforms.hidden_size);
        let inv_std_dev = inverseSqrt(${i6("square_sum",z)} / f32(uniforms.hidden_size) ${H?"":"- mean * mean"} + uniforms.epsilon);
        ${E?"mean_output[global_idx] = mean;":""}
        ${R?"inv_std_output[global_idx] = inv_std_dev;":""}

        for (var i: u32 = 0; i < stride; i++) {
          output[offset + i] = (output[offset + i] ${H?"":`- ${T}(mean)`}) *
            ${T}(inv_std_dev) * gamma[offset1d + i]
            ${B?"+ beta[offset1d + i]":""};
        }
      }`},w=[{dims:j,dataType:J[0].dataType}];return X>1&&w.push({dims:L,dataType:1}),X>2&&w.push({dims:L,dataType:1}),X>3&&w.push({dims:W,dataType:J[0].dataType}),{name:"SkipLayerNormalization",shaderCache:{hint:`${z};${E};${R};${A}`,inputDependencies:J.map((k,I)=>"type")},getShaderSource:S,getRunData:()=>({outputs:w,dispatchGroup:{x:Math.ceil(N/V)},programUniforms:D})}},_R=(J,Q)=>{tB(J.inputs);let X=[0];J.outputCount>1&&X.push(-3),J.outputCount>2&&X.push(-3),J.outputCount>3&&X.push(3),J.compute(eB(J.inputs,Q,J.outputCount,!1),{outputs:X})}}),Bz=Q0(()=>{z0(),w0(),Q1(),I0(),JL=(J,Q)=>{if(!J||J.length<1)throw Error("too few inputs");if(Q.axes.length!==0){if(Q.axes.length!==Q.starts.length||Q.axes.length!==Q.ends.length)throw Error("axes, starts and ends must have the same length")}else if(Q.starts.length!==Q.ends.length)throw Error("starts and ends must have the same length");J.slice(1).forEach((X,Y)=>{if(J[Y+1].dataType!==6&&J[Y+1].dataType!==7)throw Error(`Input ${Y} must be an array of int32 or int64`)})},d2=(J,Q)=>{let X=[];if(J.length>Q)if(J[Q].dataType===7)J[Q].getBigInt64Array().forEach((Y)=>X.push(Number(Y)));else if(J[Q].dataType===6)J[Q].getInt32Array().forEach((Y)=>X.push(Number(Y)));else throw Error(`Input ${Q} must be an array of int32 or int64`);return X},QL=(J,Q)=>{if(J.length>1){let X=d2(J,1),Y=d2(J,2),H=d2(J,3);return H.length===0&&(H=[...Array(J[0].dims.length).keys()]),d0({starts:X,ends:Y,axes:H})}else return Q},RY=(J,Q,X,Y,H)=>{let W=J;return J<0&&(W+=X[Y[Q]]),H[Q]<0?Math.max(0,Math.min(W,X[Y[Q]]-1)):Math.max(0,Math.min(W,X[Y[Q]]))},XL=(J,Q,X)=>`fn calculateInputIndices(output_indices: ${Q.type.indices}) -> ${J.type.indices} {
          var input_indices: ${J.type.indices};
          var carry = 0u;
          for (var i = ${X.length}; i >= 0; i--) {
            let input_shape_i = ${U0("uniforms.input_shape","i",X.length)};
            let steps_i = ${U0("uniforms.steps","i",X.length)};
            let signs_i = ${U0("uniforms.signs","i",X.length)};
            let starts_i = ${U0("uniforms.starts","i",X.length)};
            var output_index = ${Q.indicesGet("output_indices","i")};
            var input_index = output_index * steps_i + starts_i + carry;
            carry = input_index / input_shape_i;
            input_index = input_index % input_shape_i;
            if (signs_i < 0) {
              input_index = input_shape_i - input_index - 1u + starts_i;
            }
            ${J.indicesSet("input_indices","i","input_index")};
          }
          return input_indices;
      }`,YL=(J,Q)=>{let X=J[0].dims,Y=u.size(X),H=Q.axes.length>0?u.normalizeAxes(Q.axes,X.length):[...Array(X.length).keys()],W=d2(J,4);W.forEach((z)=>z!==0||(()=>{throw Error("step cannot be 0")})),W.length===0&&(W=Array(H.length).fill(1));let G=Q.starts.map((z,D)=>RY(z,D,X,H,W)),j=Q.ends.map((z,D)=>RY(z,D,X,H,W));if(H.length!==G.length||H.length!==j.length)throw Error("start, ends and axes should have the same number of elements");if(H.length!==X.length)for(let z=0;z<X.length;++z)H.includes(z)||(G.splice(z,0,0),j.splice(z,0,X[z]),W.splice(z,0,1));let N=W.map((z)=>Math.sign(z));W.forEach((z,D,S)=>{if(z<0){let w=(j[D]-G[D])/z,k=G[D],I=k+w*W[D];G[D]=I,j[D]=k,S[D]=-z}});let V=X.slice(0);H.forEach((z,D)=>{V[z]=Math.ceil((j[z]-G[z])/W[z])});let L={dims:V,dataType:J[0].dataType},B=B0("output",J[0].dataType,V.length),U=i("input",J[0].dataType,J[0].dims.length),E=u.size(V),R=[{name:"outputSize",type:"u32"},{name:"starts",type:"u32",length:G.length},{name:"signs",type:"i32",length:N.length},{name:"steps",type:"u32",length:W.length}],A=[{type:12,data:E},{type:12,data:G},{type:6,data:N},{type:12,data:W},...R0(J[0].dims,V)],P=(z)=>`
      ${z.registerUniforms(R).declareVariables(U,B)}
        ${XL(U,B,X)}
        ${z.mainStart()}
          ${z.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
          let output_indices = ${B.offsetToIndices("global_idx")};
          let input_indices = calculateInputIndices(output_indices);
          ${B.setByOffset("global_idx",U.getByIndices("input_indices"))}
      }`;return{name:"Slice",shaderCache:{hint:`${N.length}_${G.length}_${W.length}`,inputDependencies:["rank"]},getShaderSource:P,getRunData:()=>({outputs:[L],dispatchGroup:{x:Math.ceil(Y/64)},programUniforms:A})}},bR=(J,Q)=>{JL(J.inputs,Q);let X=QL(J.inputs,Q);J.compute(YL(J.inputs,X),{inputs:[0]})},vR=(J)=>{let{starts:Q,ends:X,axes:Y}=J;return d0({starts:Q,ends:X,axes:Y})}}),Lz=Q0(()=>{z0(),w0(),Q1(),n6(),I0(),HL=(J)=>{if(!J||J.length!==1)throw Error("Softmax op requires 1 input.")},qL=(J,Q)=>{let X=J.inputs[0],Y=X.dims,H=u.size(Y),W=Y.length,G=u.normalizeAxis(Q.axis,W),j=G<Y.length-1,N,V=[];j?(V=Array.from({length:W},(C,T)=>T),V[G]=W-1,V[W-1]=G,N=J.compute(y1(X,V),{inputs:[X],outputs:[-1]})[0]):N=X;let L=N.dims,B=L[W-1],U=H/B,E=e0(B),R=B/E,A=64;U===1&&(A=256);let P=(C,T)=>T===4?`max(max(${C}.x, ${C}.y), max(${C}.z, ${C}.w))`:T===2?`max(${C}.x, ${C}.y)`:T===3?`max(max(${C}.x, ${C}.y), ${C}.z)`:C,z=i("x",N.dataType,N.dims,E),D=B0("result",N.dataType,N.dims,E),S=z.type.value,w=K1(N.dataType)==="f32"?`var threadMax = ${S}(-3.402823e+38f);`:`var threadMax = ${S}(-65504.0h);`,k=(C)=>`
      var<workgroup> rowMaxShared : ${S};
      var<workgroup> rowSumShared : ${S};
      var<workgroup> threadShared : array<${S}, ${A}>;

      fn getValue(row: i32, col: i32, row_stride: i32) -> ${S} {
        let index = row * row_stride + col;
        return x[index];
      }

      fn setValue(row: i32, col: i32, row_stride: i32, value: ${S}) {
        let index = row * row_stride + col;
        result[index] = value;
      }
      ${C.registerUniform("packedCols","i32").declareVariables(z,D)}
      ${C.mainStart(A)}
        let gindex = i32(global_idx);
        let lindex = i32(local_idx);
        const wg = ${A};
        let row = gindex / wg;
        let cols = uniforms.packedCols;
        let row_stride : i32 = uniforms.packedCols;

        // find the rows max
        ${w}
        for (var col = lindex; col < cols; col += wg) {
          let value = getValue(row, col, row_stride);
          threadMax = max(threadMax, value);
        }
        if (lindex < cols) {
          threadShared[lindex] = threadMax;
        }
        workgroupBarrier();

        var reduceSize = min(cols, wg);
        for (var currSize = reduceSize >> 1;  currSize > 0; currSize = reduceSize >> 1) {
          reduceSize = currSize + (reduceSize & 1);
          if (lindex < currSize) {
            threadShared[lindex] = max(threadShared[lindex], threadShared[lindex + reduceSize]);
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowMaxShared = ${S}(${P("threadShared[0]",E)});
        }
        workgroupBarrier();

        // find the rows sum
        var threadSum = ${S}(0.0);
        for (var col = lindex; col < cols; col += wg) {
          let subExp = exp(getValue(row, col, row_stride) - rowMaxShared);
          threadSum += subExp;
        }
        threadShared[lindex] = threadSum;
        workgroupBarrier();

        for (var currSize = wg >> 1;  currSize > 0; currSize = currSize >> 1) {
          if (lindex < currSize) {
            threadShared[lindex] = threadShared[lindex] + threadShared[lindex + currSize];
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowSumShared = ${S}(${i6("threadShared[0]",E)});
        }
        workgroupBarrier();

        // calculate final value for each element in the row
        for (var col = lindex; col < cols; col += wg) {
          let value = exp(getValue(row, col, row_stride) - rowMaxShared) / rowSumShared;
          setValue(row, col, row_stride, value);
        }
      }`,I=J.compute({name:"Softmax",shaderCache:{hint:`${E};${A}`,inputDependencies:["type"]},getRunData:()=>({outputs:[{dims:L,dataType:N.dataType}],dispatchGroup:{x:U},programUniforms:[{type:6,data:R}]}),getShaderSource:k},{inputs:[N],outputs:[j?-1:0]})[0];j&&J.compute(y1(I,V),{inputs:[I]})},TR=(J,Q)=>{HL(J.inputs),qL(J,Q)},xR=(J)=>d0({axis:J.axis})}),Uz=Q0(()=>{z0(),w0(),I0(),EY=(J)=>Array.from(J.getBigInt64Array(),Number),WL=(J)=>{if(!J||J.length!==2)throw Error("Tile requires 2 inputs.");if(J[0].dataType!==1&&J[0].dataType!==10&&J[0].dataType!==6&&J[0].dataType!==12)throw Error("Tile only support float, float16, int32, and uint32 data types");if(J[1].dataType!==7)throw Error("Tile `repeats` input should be of int64 data type");if(J[1].dims.length!==1)throw Error("Tile `repeats` input should be 1-D");if(EY(J[1]).length!==J[0].dims.length)throw Error("Tile `repeats` input should have same number of elements as rank of input data tensor")},GL=(J,Q)=>{let X=[];for(let Y=0;Y<J.length;++Y)X.push(J[Y]*Q[Y]);return X},jL=(J,Q)=>{let X=J[0].dims,Y=Q??EY(J[1]),H=GL(X,Y),W=u.size(H),G=J[0].dataType,j=i("input",G,X.length),N=B0("output",G,H.length),V=(L)=>`
      const inputShape = ${j.indices(...X)};
      ${L.registerUniform("output_size","u32").declareVariables(j,N)}
      ${L.mainStart()}
      ${L.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let output_indices = ${N.offsetToIndices("global_idx")};
      var input_indices: ${j.type.indices};
      for (var i = 0; i < ${X.length}; i++) {
        let input_dim_i = ${j.indicesGet("uniforms.input_shape","i")};
        let input_dim_value = ${N.indicesGet("output_indices","i")}  % input_dim_i;

        ${j.indicesSet("input_indices","i","input_dim_value")}
      }
      ${N.setByOffset("global_idx",j.getByIndices("input_indices"))}
    }`;return{name:"Tile",shaderCache:{hint:`${Y}`,inputDependencies:["rank"]},getRunData:()=>({outputs:[{dims:H,dataType:J[0].dataType}],dispatchGroup:{x:Math.ceil(W/64)},programUniforms:[{type:12,data:W},...R0(J[0].dims,H)]}),getShaderSource:V}},fR=(J)=>{WL(J.inputs),J.compute(jL(J.inputs),{inputs:[0]})}}),Oz=Q0(()=>{z0(),w0(),I0(),FL=(J,Q,X,Y,H)=>{let W=B0("output_data",H,X.length,4),G=i("a_data",Q[1].dataType,Q[1].dims.length,4),j=i("b_data",Q[2].dataType,Q[2].dims.length,4),N=i("c_data",Q[0].dataType,Q[0].dims.length,4),V,L=(B,U,E)=>`select(${U}, ${B}, ${E})`;if(!Y)V=W.setByOffset("global_idx",L(G.getByOffset("global_idx"),j.getByOffset("global_idx"),N.getByOffset("global_idx")));else{let B=(U,E,R="")=>{let A=`a_data[index_a${E}][component_a${E}]`,P=`b_data[index_b${E}][component_b${E}]`,z=`bool(c_data[index_c${E}] & (0xffu << (component_c${E} * 8)))`;return`
            let output_indices${E} = ${W.offsetToIndices(`global_idx * 4u + ${E}u`)};
            let offset_a${E} = ${G.broadcastedIndicesToOffset(`output_indices${E}`,W)};
            let offset_b${E} = ${j.broadcastedIndicesToOffset(`output_indices${E}`,W)};
            let offset_c${E} = ${N.broadcastedIndicesToOffset(`output_indices${E}`,W)};
            let index_a${E} = offset_a${E} / 4u;
            let index_b${E} = offset_b${E} / 4u;
            let index_c${E} = offset_c${E} / 4u;
            let component_a${E} = offset_a${E} % 4u;
            let component_b${E} = offset_b${E} % 4u;
            let component_c${E} = offset_c${E} % 4u;
            ${U}[${E}] = ${R}(${L(A,P,z)});
          `};H===9?V=`
            var data = vec4<u32>(0);
            ${B("data",0,"u32")}
            ${B("data",1,"u32")}
            ${B("data",2,"u32")}
            ${B("data",3,"u32")}
            output_data[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));`:V=`
            ${B("output_data[global_idx]",0)}
            ${B("output_data[global_idx]",1)}
            ${B("output_data[global_idx]",2)}
            ${B("output_data[global_idx]",3)}
          `}return`
        ${J.registerUniform("vec_size","u32").declareVariables(N,G,j,W)}
        ${J.mainStart()}
        ${J.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${V}
      }`},NL=(J)=>{let Q=J[1].dims,X=J[2].dims,Y=J[0].dims,H=J[1].dataType,W=!(u.areEqual(Q,X)&&u.areEqual(X,Y)),G=Q,j=u.size(Q);if(W){let V=q7.calcShape(q7.calcShape(Q,X,!1),Y,!1);if(!V)throw Error("Can't perform where op on the given tensors");G=V,j=u.size(G)}let N=Math.ceil(j/4);return{name:"Where",shaderCache:{inputDependencies:["rank","rank","rank"]},getShaderSource:(V)=>FL(V,J,G,W,H),getRunData:()=>({outputs:[{dims:G,dataType:H}],dispatchGroup:{x:Math.ceil(j/64/4)},programUniforms:[{type:12,data:N},...R0(Y,Q,X,G)]})}},hR=(J)=>{J.compute(NL(J.inputs))}}),Rz=Q0(()=>{_A(),YH(),bA(),vA(),TA(),xA(),fA(),mA(),cA(),dA(),uA(),oA(),sA(),aA(),iA(),nA(),rA(),tA(),eA(),Jz(),Qz(),Xz(),Yz(),Hz(),qz(),HR(),Wz(),Gz(),jz(),Fz(),Nz(),XH(),Vz(),Kz(),Mz(),Bz(),Lz(),GR(),Uz(),n6(),HH(),Oz(),yR=new Map([["Abs",[bU]],["Acos",[vU]],["Acosh",[TU]],["Add",[BO]],["ArgMax",[kU,_Y]],["ArgMin",[wU,_Y]],["Asin",[xU]],["Asinh",[fU]],["Atan",[hU]],["Atanh",[yU]],["Attention",[CU]],["AveragePool",[UR,LR]],["BatchNormalization",[IU]],["BiasAdd",[_U]],["BiasSplitGelu",[MO]],["Cast",[lU,gU]],["Ceil",[pU]],["Clip",[mU]],["Concat",[PO,SO]],["Conv",[hY,fY]],["ConvTranspose",[xO,TO]],["Cos",[cU]],["Cosh",[dU]],["CumSum",[fO,hO]],["DepthToSpace",[yO,gO]],["DequantizeLinear",[$R,PR]],["Div",[LO]],["Einsum",[lO,mO]],["Elu",[uU,a2]],["Equal",[UO]],["Erf",[oU]],["Exp",[sU]],["Expand",[pO]],["FastGelu",[cO]],["Floor",[aU]],["FusedConv",[hY,fY]],["Gather",[uO,dO]],["GatherElements",[rO,nO]],["GatherBlockQuantized",[aO,iO]],["GatherND",[oO,sO]],["Gelu",[iU]],["Gemm",[eO,tO]],["GlobalAveragePool",[RR,OR]],["GlobalMaxPool",[zR,AR]],["Greater",[DO]],["GreaterOrEqual",[zO]],["GridSample",[JR,QR]],["GroupQueryAttention",[jR]],["HardSigmoid",[YO,XO]],["InstanceNormalization",[FR]],["LayerNormalization",[NR]],["LeakyRelu",[nU,a2]],["Less",[AO]],["LessOrEqual",[$O]],["Log",[VO]],["MatMul",[VR]],["MatMulNBits",[KR,MR]],["MaxPool",[ER,DR]],["Mul",[OO]],["MultiHeadAttention",[YR,XR]],["Neg",[tU]],["Not",[rU]],["Pad",[BR]],["Pow",[RO]],["QuickGelu",[KO,a2]],["Range",[SR]],["Reciprocal",[eU]],["ReduceMin",[zU]],["ReduceMean",[OU]],["ReduceMax",[AU]],["ReduceSum",[PU]],["ReduceProd",[$U]],["ReduceL1",[RU]],["ReduceL2",[EU]],["ReduceLogSum",[ZU]],["ReduceLogSumExp",[DU]],["ReduceSumSquare",[SU]],["Relu",[JO]],["Resize",[kR,CR]],["RotaryEmbedding",[IR]],["ScatterND",[wR,ZR]],["Sigmoid",[QO]],["Sin",[HO]],["Sinh",[qO]],["Slice",[bR,vR]],["SkipLayerNormalization",[_R]],["Split",[qR,WR]],["Sqrt",[WO]],["Softmax",[TR,xR]],["Sub",[EO]],["Tan",[GO]],["Tanh",[jO]],["ThresholdedRelu",[NO,a2]],["Tile",[fR]],["Transpose",[qU,WU]],["Where",[hR]]])}),Ez=Q0(()=>{M6(),h6(),I0(),gR=class{constructor(J){this.backend=J,this.repo=new Map,this.attributesBound=!1}getArtifact(J){return this.repo.get(J)}setArtifact(J,Q){this.repo.set(J,Q)}run(J,Q,X,Y,H){K6(J.programInfo.name);let W=this.backend.device,G=this.backend.getComputePassEncoder();this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2);let j=[];for(let V of Q)j.push({binding:j.length,resource:{buffer:V.buffer}});for(let V of X)j.push({binding:j.length,resource:{buffer:V.buffer}});H&&j.push({binding:j.length,resource:H});let N=W.createBindGroup({layout:J.computePipeline.getBindGroupLayout(0),entries:j,label:J.programInfo.name});if(this.backend.sessionStatus==="capturing"){let V={kernelId:this.backend.currentKernelId,computePipeline:J.computePipeline,bindGroup:N,dispatchGroup:Y};this.backend.capturedCommandList.get(this.backend.currentSessionId).push(V)}G.setPipeline(J.computePipeline),G.setBindGroup(0,N),G.dispatchWorkgroups(...Y),this.backend.writeTimestamp(this.backend.pendingDispatchNumber*2+1),this.backend.pendingDispatchNumber++,(this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber||this.backend.queryType==="at-passes")&&this.backend.endComputePass(),this.backend.pendingDispatchNumber>=this.backend.maxDispatchNumber&&this.backend.flush(),d1(J.programInfo.name)}dispose(){}build(J,Q){K6(J.name);let X=this.backend.device,Y=[];[{feature:"shader-f16",extension:"f16"},{feature:"subgroups",extension:"subgroups"},{feature:"subgroups-f16",extension:"subgroups_f16"}].forEach((V)=>{X.features.has(V.feature)&&Y.push(`enable ${V.extension};`)});let H=HU(Q,this.backend.device.limits),W=J.getShaderSource(H),G=`${Y.join(`
`)}
${H.additionalImplementations}
${W}`,j=X.createShaderModule({code:G,label:J.name});f0("verbose",()=>`[WebGPU] ${J.name} shader code: ${G}`);let N=X.createComputePipeline({compute:{module:j,entryPoint:"main"},layout:"auto",label:J.name});return d1(J.name),{programInfo:J,computePipeline:N,uniformVariablesInfo:H.variablesInfo}}normalizeDispatchGroupSize(J){let Q=typeof J=="number"?J:J.x,X=typeof J=="number"?1:J.y||1,Y=typeof J=="number"?1:J.z||1,H=this.backend.device.limits.maxComputeWorkgroupsPerDimension;if(Q<=H&&X<=H&&Y<=H)return[Q,X,Y];let W=Q*X*Y,G=Math.ceil(Math.sqrt(W));if(G>H){if(G=Math.ceil(Math.cbrt(W)),G>H)throw Error("Total dispatch size exceeds WebGPU maximum.");return[G,G,G]}else return[G,G,1]}}}),Dz=Q0(()=>{M6(),z0(),h6(),tL(),CA(),Rz(),Ez(),VL=(J,Q)=>{if(Q.length!==J.length)throw Error(`inputDependencies length ${Q.length} is not equal to inputTensors length ${J.length}.`);let X=[];for(let Y=0;Y<J.length;++Y){let H=J[Y].dataType;switch(Q[Y]){case"none":{X.push("");break}case"type":{X.push(`${H}`);break}case"rank":{let W=J[Y].dims.length;X.push(`${H};${W}`);break}case"dims":{let W=J[Y].dims.join(",");X.push(`${H};${W}`);break}default:throw Error(`unsupported input dependency: ${Q[Y]}`)}}return X.join("|")},KL=(J,Q,X)=>{let Y=J.name;return J.shaderCache?.hint&&(Y+="["+J.shaderCache.hint+"]"),Y+=":"+X+`:${VL(Q,J.shaderCache?.inputDependencies??Array(Q.length).fill("dims"))}`,Y},ML=class{constructor(J){J&&(this.architecture=J.architecture,this.vendor=J.vendor)}isArchitecture(J){return this.architecture===J}isVendor(J){return this.vendor===J}},BL=class{constructor(J){this.subgroupsSupported=J.features.has("subgroups"),this.subgroupsF16Supported=J.features.has("subgroups");let Q=J.limits;!this.subgroupsSupported||!Q.minSubgroupSize||!Q.maxSubgroupSize?this.subgroupSizeRange=void 0:this.subgroupSizeRange=[Q.minSubgroupSize,Q.maxSubgroupSize]}},lR=class{constructor(){this.currentSessionId=null,this.currentKernelId=null,this.commandEncoder=null,this.computePassEncoder=null,this.maxDispatchNumber=16,this.pendingDispatchNumber=0,this.pendingKernels=[],this.pendingQueries=new Map,this.sessionStatus="default",this.capturedCommandList=new Map,this.capturedPendingKernels=new Map,this.sessionExternalDataMapping=new Map}get currentKernelCustomData(){if(this.currentKernelId===null)throw Error("currentKernelCustomData(): currentKernelId is null. (should not happen)");let J=this.kernelCustomData.get(this.currentKernelId);return J||(J={},this.kernelCustomData.set(this.currentKernelId,J)),J}async initialize(J,Q){this.env=J;let X=[],Y={requiredLimits:{maxComputeWorkgroupStorageSize:Q.limits.maxComputeWorkgroupStorageSize,maxComputeWorkgroupsPerDimension:Q.limits.maxComputeWorkgroupsPerDimension,maxStorageBufferBindingSize:Q.limits.maxStorageBufferBindingSize,maxBufferSize:Q.limits.maxBufferSize,maxComputeInvocationsPerWorkgroup:Q.limits.maxComputeInvocationsPerWorkgroup,maxComputeWorkgroupSizeX:Q.limits.maxComputeWorkgroupSizeX,maxComputeWorkgroupSizeY:Q.limits.maxComputeWorkgroupSizeY,maxComputeWorkgroupSizeZ:Q.limits.maxComputeWorkgroupSizeZ},requiredFeatures:X},H=(W)=>Q.features.has(W)&&X.push(W)&&!0;H("chromium-experimental-timestamp-query-inside-passes")||H("timestamp-query"),H("shader-f16"),H("subgroups")&&H("subgroups-f16"),this.device=await Q.requestDevice(Y),this.deviceInfo=new BL(this.device),this.adapterInfo=new ML(Q.info||await Q.requestAdapterInfo()),this.gpuDataManager=eL(this),this.programManager=new gR(this),this.kernels=new Map,this.kernelPersistentData=new Map,this.kernelCustomData=new Map,tY(J.logLevel,!!J.debug),this.device.onuncapturederror=(W)=>{W.error instanceof GPUValidationError&&console.error(`An uncaught WebGPU validation error was raised: ${W.error.message}`)},Object.defineProperty(this.env.webgpu,"device",{value:this.device,writable:!1,enumerable:!0,configurable:!1}),Object.defineProperty(this.env.webgpu,"adapter",{value:Q,writable:!1,enumerable:!0,configurable:!1}),this.setQueryType()}dispose(){typeof this.querySet<"u"&&this.querySet.destroy(),this.gpuDataManager.dispose()}getCommandEncoder(){return this.commandEncoder||(this.commandEncoder=this.device.createCommandEncoder()),this.commandEncoder}getComputePassEncoder(){if(!this.computePassEncoder){let J=this.getCommandEncoder(),Q={};this.queryType==="at-passes"&&(Q.timestampWrites={querySet:this.querySet,beginningOfPassWriteIndex:this.pendingDispatchNumber*2,endOfPassWriteIndex:this.pendingDispatchNumber*2+1}),this.computePassEncoder=J.beginComputePass(Q)}return this.computePassEncoder}endComputePass(){this.computePassEncoder&&(this.computePassEncoder.end(),this.computePassEncoder=null)}flush(){if(!this.commandEncoder)return;K6(),this.endComputePass();let J;this.queryType!=="none"&&(this.commandEncoder.resolveQuerySet(this.querySet,0,this.pendingDispatchNumber*2,this.queryResolveBuffer,0),J=this.device.createBuffer({size:this.pendingDispatchNumber*2*8,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.pendingQueries.set(J,this.pendingKernels),this.pendingKernels=[],this.commandEncoder.copyBufferToBuffer(this.queryResolveBuffer,0,J,0,this.pendingDispatchNumber*2*8)),this.device.queue.submit([this.commandEncoder.finish()]),this.gpuDataManager.refreshPendingBuffers(),this.commandEncoder=null,this.pendingDispatchNumber=0,this.queryType!=="none"&&J.mapAsync(GPUMapMode.READ).then(()=>{let Q=new BigUint64Array(J.getMappedRange()),X=this.pendingQueries.get(J);for(let Y=0;Y<Q.length/2;Y++){let H=X[Y],W=H.kernelId,G=this.kernels.get(W),j=G.kernelType,N=G.kernelName,V=H.programName,L=H.inputTensorViews,B=H.outputTensorViews,U=Q[Y*2],E=Q[Y*2+1];typeof this.queryTimeBase>"u"&&(this.queryTimeBase=U);let R=Number(U-this.queryTimeBase),A=Number(E-this.queryTimeBase);if(!Number.isSafeInteger(R)||!Number.isSafeInteger(A))throw RangeError("incorrect timestamp range");if(this.env.webgpu.profiling?.ondata)this.env.webgpu.profiling.ondata({version:1,inputsMetadata:L.map((P)=>({dims:P.dims,dataType:g8(P.dataType)})),outputsMetadata:B.map((P)=>({dims:P.dims,dataType:g8(P.dataType)})),kernelId:W,kernelType:j,kernelName:N,programName:V,startTime:R,endTime:A});else{let P="";L.forEach((D,S)=>{P+=`input[${S}]: [${D.dims}] | ${g8(D.dataType)}, `});let z="";B.forEach((D,S)=>{z+=`output[${S}]: [${D.dims}] | ${g8(D.dataType)}, `}),console.log(`[profiling] kernel "${W}|${j}|${N}|${V}" ${P}${z}execution time: ${A-R} ns`)}r2("GPU",`${V}::${U}::${E}`)}J.unmap(),this.pendingQueries.delete(J)}),d1()}run(J,Q,X,Y,H,W){K6(J.name);let G=[];for(let D=0;D<Q.length;++D){let S=Q[D].data;if(S===0)continue;let w=this.gpuDataManager.get(S);if(!w)throw Error(`no GPU data for input: ${S}`);G.push(w)}let{outputs:j,dispatchGroup:N,programUniforms:V}=J.getRunData(Q),L=X.length===0?j.map((D,S)=>S):X;if(L.length!==j.length)throw Error(`Output size ${L.length} must be equal to ${j.length}.`);let B=[],U=[];for(let D=0;D<j.length;++D){if(!Number.isInteger(L[D])||L[D]<-3||L[D]>=W)throw Error(`Invalid output index: ${L[D]}`);if(L[D]===-3)continue;let S=L[D]===-1,w=L[D]===-2,k=S||w?H(j[D].dataType,j[D].dims):Y(L[D],j[D].dataType,j[D].dims);if(B.push(k),k.data===0)continue;let I=this.gpuDataManager.get(k.data);if(!I)throw Error(`no GPU data for output: ${k.data}`);if(S&&this.temporaryData.push(I),w){let C=this.kernelPersistentData.get(this.currentKernelId);C||(C=[],this.kernelPersistentData.set(this.currentKernelId,C)),C.push(I)}U.push(I)}if(G.length!==Q.length||U.length!==B.length){if(U.length===0)return d1(J.name),B;throw Error(`Program ${J.name} has zero-sized tensor(s) in inputs or outputs. This is not supported now.`)}let E;if(V){let D=0,S=[];V.forEach((C)=>{let T=typeof C.data=="number"?[C.data]:C.data;if(T.length===0)return;let g=C.type===10?2:4,m,l;C.type===10?(l=T.length>4?16:T.length>2?8:T.length*g,m=T.length>4?16:g*T.length):(l=T.length<=2?T.length*g:16,m=16),D=Math.ceil(D/l)*l,S.push(D);let t=C.type===10?8:4;D+=T.length>4?Math.ceil(T.length/t)*m:T.length*g});let w=16;D=Math.ceil(D/w)*w;let k=new ArrayBuffer(D);V.forEach((C,T)=>{let g=S[T],m=typeof C.data=="number"?[C.data]:C.data;if(C.type===6)new Int32Array(k,g,m.length).set(m);else if(C.type===12)new Uint32Array(k,g,m.length).set(m);else if(C.type===10)new Uint16Array(k,g,m.length).set(m);else if(C.type===1)new Float32Array(k,g,m.length).set(m);else throw Error(`Unsupported uniform type: ${g8(C.type)}`)});let I=this.gpuDataManager.create(D,GPUBufferUsage.COPY_DST|GPUBufferUsage.UNIFORM);this.device.queue.writeBuffer(I.buffer,0,k,0,D),this.gpuDataManager.release(I.id),E={offset:0,size:D,buffer:I.buffer}}let R=this.programManager.normalizeDispatchGroupSize(N),A=R[1]===1&&R[2]===1,P=KL(J,Q,A),z=this.programManager.getArtifact(P);if(z||(z=this.programManager.build(J,R),this.programManager.setArtifact(P,z),f0("info",()=>`[artifact] key: ${P}, programName: ${J.name}`)),V&&z.uniformVariablesInfo){if(V.length!==z.uniformVariablesInfo.length)throw Error(`Uniform variables count mismatch: expect ${z.uniformVariablesInfo.length}, got ${V.length} in program "${z.programInfo.name}".`);for(let D=0;D<V.length;D++){let S=V[D],w=S.type,k=typeof S.data=="number"?1:S.data.length,[I,C]=z.uniformVariablesInfo[D];if(w!==I||k!==C)throw Error(`Uniform variable ${D} mismatch: expect type ${I} with size ${C}, got type ${w} with size ${k} in program "${z.programInfo.name}".`)}}if(f0("info",()=>`[ProgramManager] run "${J.name}" (key=${P}) with ${R[0]}x${R[1]}x${R[2]}`),this.queryType!=="none"||this.sessionStatus==="capturing"){let D={kernelId:this.currentKernelId,programName:z.programInfo.name,inputTensorViews:Q,outputTensorViews:B};this.pendingKernels.push(D),this.sessionStatus==="capturing"&&this.capturedPendingKernels.get(this.currentSessionId).push(D)}return this.programManager.run(z,G,U,R,E),d1(J.name),B}upload(J,Q){this.gpuDataManager.upload(J,Q)}memcpy(J,Q){this.gpuDataManager.memcpy(J,Q)}async download(J,Q){await this.gpuDataManager.download(J,Q)}alloc(J){return this.gpuDataManager.create(J).id}free(J){return this.gpuDataManager.release(J)}createKernel(J,Q,X,Y){let H=yR.get(J);if(!H)throw Error(`kernel not implemented: ${J}`);let W={kernelType:J,kernelName:Y,kernelEntry:H[0],attributes:[H[1],X]};this.kernels.set(Q,W)}releaseKernel(J){let Q=this.kernelPersistentData.get(J);if(Q){for(let X of Q)this.gpuDataManager.release(X.id);this.kernelPersistentData.delete(J)}this.kernelCustomData.delete(J),this.kernels.delete(J)}computeKernel(J,Q,X){let Y=this.kernels.get(J);if(!Y)throw Error(`kernel not created: ${J}`);let{kernelType:H,kernelName:W,kernelEntry:G,attributes:j}=Y;if(this.currentKernelId!==null)throw Error(`kernel "[${H}] ${W}" is not allowed to be called recursively`);this.currentKernelId=J,j[0]&&(j[1]=j[0](j[1]),j[0]=void 0),f0("info",()=>`[WebGPU] Start to run kernel "[${H}] ${W}"...`);let N=this.env.debug;this.temporaryData=[];try{return N&&this.device.pushErrorScope("validation"),G(Q,j[1]),0}catch(V){return X.push(Promise.resolve(`[WebGPU] Kernel "[${H}] ${W}" failed. ${V}`)),1}finally{N&&X.push(this.device.popErrorScope().then((V)=>V?`GPU validation error for kernel "[${H}] ${W}": ${V.message}`:null));for(let V of this.temporaryData)this.gpuDataManager.release(V.id);this.temporaryData=[],this.currentKernelId=null}}registerBuffer(J,Q,X,Y){let H=this.sessionExternalDataMapping.get(J);H||(H=new Map,this.sessionExternalDataMapping.set(J,H));let W=H.get(Q),G=this.gpuDataManager.registerExternalBuffer(X,Y,W);return H.set(Q,[G,X]),G}unregisterBuffers(J){let Q=this.sessionExternalDataMapping.get(J);Q&&(Q.forEach((X)=>this.gpuDataManager.unregisterExternalBuffer(X[0])),this.sessionExternalDataMapping.delete(J))}getBuffer(J){let Q=this.gpuDataManager.get(J);if(!Q)throw Error(`no GPU data for buffer: ${J}`);return Q.buffer}createDownloader(J,Q,X){return async()=>{let Y=await kY(this,J,Q);return eY(Y.buffer,X)}}writeTimestamp(J){this.queryType==="inside-passes"&&this.computePassEncoder.writeTimestamp(this.querySet,J)}setQueryType(){this.queryType="none",(this.env.webgpu.profiling?.mode==="default"||(typeof this.env.trace>"u"?this.env.wasm.trace:this.env.trace))&&(this.device.features.has("chromium-experimental-timestamp-query-inside-passes")?this.queryType="inside-passes":this.device.features.has("timestamp-query")&&(this.queryType="at-passes"),this.queryType!=="none"&&typeof this.querySet>"u"&&(this.querySet=this.device.createQuerySet({type:"timestamp",count:this.maxDispatchNumber*2}),this.queryResolveBuffer=this.device.createBuffer({size:this.maxDispatchNumber*2*8,usage:GPUBufferUsage.COPY_SRC|GPUBufferUsage.QUERY_RESOLVE})))}captureBegin(){f0("info","captureBegin"),this.capturedCommandList.get(this.currentSessionId)||this.capturedCommandList.set(this.currentSessionId,[]),this.capturedPendingKernels.get(this.currentSessionId)||this.capturedPendingKernels.set(this.currentSessionId,[]),this.flush(),this.sessionStatus="capturing"}captureEnd(){f0("info","captureEnd"),this.flush(),this.sessionStatus="default"}replay(){f0("info","replay"),this.sessionStatus="replaying";let J=this.capturedCommandList.get(this.currentSessionId),Q=this.capturedPendingKernels.get(this.currentSessionId),X=J.length;this.pendingKernels=[];for(let Y=0;Y<X;Y++){let H=this.getComputePassEncoder(),W=J[Y];this.writeTimestamp(this.pendingDispatchNumber*2),H.setPipeline(W.computePipeline),H.setBindGroup(0,W.bindGroup),H.dispatchWorkgroups(...W.dispatchGroup),this.writeTimestamp(this.pendingDispatchNumber*2+1),this.pendingDispatchNumber++,this.queryType!=="none"&&this.pendingKernels.push(Q[Y]),(this.pendingDispatchNumber>=this.maxDispatchNumber||this.queryType==="at-passes")&&this.endComputePass(),this.pendingDispatchNumber>=this.maxDispatchNumber&&this.flush()}this.flush(),this.sessionStatus="default"}onCreateSession(){this.gpuDataManager.onCreateSession()}onReleaseSession(J){this.unregisterBuffers(J),this.capturedCommandList.has(J)&&this.capturedCommandList.delete(J),this.capturedPendingKernels.has(J)&&this.capturedPendingKernels.delete(J),this.gpuDataManager.onReleaseSession(J)}onRunStart(J){this.currentSessionId=J,this.setQueryType()}}}),Az=Q0(()=>{h6(),LL=1,DY=()=>LL++,UL=new Map([["float32",32],["float16",16],["int32",32],["uint32",32],["int64",64],["uint64",64],["int8",8],["uint8",8],["int4",4],["uint4",4]]),AY=(J,Q)=>{let X=UL.get(J);if(!X)throw Error("Unsupported data type.");return Q.length>0?Math.ceil(Q.reduce((Y,H)=>Y*H)*X/8):0},zY=class{constructor(J){this.sessionId=J.sessionId,this.mlContext=J.context,this.mlTensor=J.tensor,this.dataType=J.dataType,this.tensorShape=J.shape}get tensor(){return this.mlTensor}get type(){return this.dataType}get shape(){return this.tensorShape}get byteLength(){return AY(this.dataType,this.tensorShape)}destroy(){f0("verbose",()=>"[WebNN] TensorWrapper.destroy"),this.mlTensor.destroy()}write(J){this.mlContext.writeTensor(this.mlTensor,J)}async read(J){return J?this.mlContext.readTensor(this.mlTensor,J):this.mlContext.readTensor(this.mlTensor)}canReuseTensor(J,Q,X){return this.mlContext===J&&this.dataType===Q&&this.tensorShape.length===X.length&&this.tensorShape.every((Y,H)=>Y===X[H])}},$Y=class{constructor(J,Q){this.tensorManager=J,this.wrapper=Q}get tensorWrapper(){return this.wrapper}releaseTensor(){this.tensorWrapper&&(this.tensorManager.releaseTensor(this.tensorWrapper),this.wrapper=void 0)}async ensureTensor(J,Q,X,Y){let H=this.tensorManager.getMLContext(J);if(this.wrapper){if(this.wrapper.canReuseTensor(H,Q,X))return this.wrapper.tensor;if(Y){if(this.wrapper.byteLength!==AY(Q,X))throw Error("Unable to copy data to tensor with different size.");this.activeUpload=new Uint8Array(await this.wrapper.read())}this.tensorManager.releaseTensor(this.wrapper)}let W=typeof MLTensorUsage>"u"?void 0:MLTensorUsage.READ|MLTensorUsage.WRITE;return this.wrapper=await this.tensorManager.getCachedTensor(J,Q,X,W,!0,!0),Y&&this.activeUpload&&(this.wrapper.write(this.activeUpload),this.activeUpload=void 0),this.wrapper.tensor}upload(J){if(this.wrapper)if(J.byteLength===this.wrapper.byteLength){this.wrapper.write(J);return}else f0("verbose",()=>"Data size does not match tensor size. Releasing tensor."),this.releaseTensor();this.activeUpload?this.activeUpload.set(J):this.activeUpload=new Uint8Array(J)}async download(J){if(this.activeUpload)if(J){J instanceof ArrayBuffer?new Uint8Array(J).set(this.activeUpload):new Uint8Array(J.buffer,J.byteOffset,J.byteLength).set(this.activeUpload);return}else return this.activeUpload.buffer;if(!this.wrapper)throw Error("Tensor has not been created.");return J?this.wrapper.read(J):this.wrapper.read()}},OL=class{constructor(J){this.backend=J,this.tensorTrackersById=new Map,this.freeTensors=[],this.externalTensors=new Set}getMLContext(J){let Q=this.backend.getMLContext(J);if(!Q)throw Error("MLContext not found for session.");return Q}reserveTensorId(){let J=DY();return this.tensorTrackersById.set(J,new $Y(this)),J}releaseTensorId(J){let Q=this.tensorTrackersById.get(J);Q&&(this.tensorTrackersById.delete(J),Q.tensorWrapper&&this.releaseTensor(Q.tensorWrapper))}async ensureTensor(J,Q,X,Y,H){f0("verbose",()=>`[WebNN] TensorManager.ensureTensor {tensorId: ${Q}, dataType: ${X}, shape: ${Y}, copyOld: ${H}}`);let W=this.tensorTrackersById.get(Q);if(!W)throw Error("Tensor not found.");return W.ensureTensor(J,X,Y,H)}upload(J,Q){let X=this.tensorTrackersById.get(J);if(!X)throw Error("Tensor not found.");X.upload(Q)}async download(J,Q){f0("verbose",()=>`[WebNN] TensorManager.download {tensorId: ${J}, dstBuffer: ${Q?.byteLength}}`);let X=this.tensorTrackersById.get(J);if(!X)throw Error("Tensor not found.");return X.download(Q)}releaseTensorsForSession(J){for(let Q of this.freeTensors)Q.sessionId===J&&Q.destroy();this.freeTensors=this.freeTensors.filter((Q)=>Q.sessionId!==J)}registerTensor(J,Q,X,Y){let H=this.getMLContext(J),W=DY(),G=new zY({sessionId:J,context:H,tensor:Q,dataType:X,shape:Y});return this.tensorTrackersById.set(W,new $Y(this,G)),this.externalTensors.add(G),W}async getCachedTensor(J,Q,X,Y,H,W){let G=this.getMLContext(J);for(let[N,V]of this.freeTensors.entries())if(V.canReuseTensor(G,Q,X)){f0("verbose",()=>`[WebNN] Reusing tensor {dataType: ${Q}, shape: ${X}}`);let L=this.freeTensors.splice(N,1)[0];return L.sessionId=J,L}f0("verbose",()=>`[WebNN] MLContext.createTensor {dataType: ${Q}, shape: ${X}}`);let j=await G.createTensor({dataType:Q,shape:X,dimensions:X,usage:Y,writable:H,readable:W});return new zY({sessionId:J,context:G,tensor:j,dataType:Q,shape:X})}releaseTensor(J){this.externalTensors.has(J)&&this.externalTensors.delete(J),this.freeTensors.push(J)}},mR=(...J)=>new OL(...J)}),zz=Q0(()=>{z0(),u8(),tL(),Az(),h6(),J4=new Map([[1,"float32"],[10,"float16"],[6,"int32"],[12,"uint32"],[7,"int64"],[13,"uint64"],[22,"int4"],[21,"uint4"],[3,"int8"],[2,"uint8"],[9,"uint8"]]),RL=(J,Q)=>{if(J===Q)return!0;if(J===void 0||Q===void 0)return!1;let X=Object.keys(J).sort(),Y=Object.keys(Q).sort();return X.length===Y.length&&X.every((H,W)=>H===Y[W]&&J[H]===Q[H])},pR=class{constructor(J){this.tensorManager=mR(this),this.mlContextBySessionId=new Map,this.sessionIdsByMLContext=new Map,this.mlContextCache=[],this.sessionGraphInputs=new Map,this.temporaryGraphInputs=[],this.temporarySessionTensorIds=new Map,tY(J.logLevel,!!J.debug)}get currentSessionId(){if(this.activeSessionId===void 0)throw Error("No active session");return this.activeSessionId}onRunStart(J){f0("verbose",()=>`[WebNN] onRunStart {sessionId: ${J}}`),this.activeSessionId=J}onRunEnd(J){f0("verbose",()=>`[WebNN] onRunEnd {sessionId: ${J}}`);let Q=this.temporarySessionTensorIds.get(J);if(Q){for(let X of Q)f0("verbose",()=>`[WebNN] releasing temporary tensor {tensorId: ${X}}`),this.tensorManager.releaseTensorId(X);this.temporarySessionTensorIds.delete(J),this.activeSessionId=void 0}}async createMLContext(J){if(J instanceof GPUDevice){let X=this.mlContextCache.findIndex((Y)=>Y.gpuDevice===J);if(X!==-1)return this.mlContextCache[X].mlContext;{let Y=await navigator.ml.createContext(J);return this.mlContextCache.push({gpuDevice:J,mlContext:Y}),Y}}else if(J===void 0){let X=this.mlContextCache.findIndex((Y)=>Y.options===void 0&&Y.gpuDevice===void 0);if(X!==-1)return this.mlContextCache[X].mlContext;{let Y=await navigator.ml.createContext();return this.mlContextCache.push({mlContext:Y}),Y}}let Q=this.mlContextCache.findIndex((X)=>RL(X.options,J));if(Q!==-1)return this.mlContextCache[Q].mlContext;{let X=await navigator.ml.createContext(J);return this.mlContextCache.push({options:J,mlContext:X}),X}}registerMLContext(J,Q){this.mlContextBySessionId.set(J,Q);let X=this.sessionIdsByMLContext.get(Q);X||(X=new Set,this.sessionIdsByMLContext.set(Q,X)),X.add(J),this.temporaryGraphInputs.length>0&&(this.sessionGraphInputs.set(J,this.temporaryGraphInputs),this.temporaryGraphInputs=[])}onReleaseSession(J){this.sessionGraphInputs.delete(J);let Q=this.mlContextBySessionId.get(J);if(!Q)return;this.tensorManager.releaseTensorsForSession(J),this.mlContextBySessionId.delete(J);let X=this.sessionIdsByMLContext.get(Q);if(X.delete(J),X.size===0){this.sessionIdsByMLContext.delete(Q);let Y=this.mlContextCache.findIndex((H)=>H.mlContext===Q);Y!==-1&&this.mlContextCache.splice(Y,1)}}getMLContext(J){return this.mlContextBySessionId.get(J)}reserveTensorId(){return this.tensorManager.reserveTensorId()}releaseTensorId(J){f0("verbose",()=>`[WebNN] releaseTensorId {tensorId: ${J}}`),this.tensorManager.releaseTensorId(J)}async ensureTensor(J,Q,X,Y,H){let W=J4.get(X);if(!W)throw Error(`Unsupported ONNX data type: ${X}`);return this.tensorManager.ensureTensor(J??this.currentSessionId,Q,W,Y,H)}async createTemporaryTensor(J,Q,X){f0("verbose",()=>`[WebNN] createTemporaryTensor {onnxDataType: ${Q}, shape: ${X}}`);let Y=J4.get(Q);if(!Y)throw Error(`Unsupported ONNX data type: ${Q}`);let H=this.tensorManager.reserveTensorId();await this.tensorManager.ensureTensor(J,H,Y,X,!1);let W=this.temporarySessionTensorIds.get(J);return W?W.push(H):this.temporarySessionTensorIds.set(J,[H]),H}uploadTensor(J,Q){if(!V1().shouldTransferToMLTensor)throw Error("Trying to upload to a MLTensor while shouldTransferToMLTensor is false");f0("verbose",()=>`[WebNN] uploadTensor {tensorId: ${J}, data: ${Q.byteLength}}`),this.tensorManager.upload(J,Q)}async downloadTensor(J,Q){return this.tensorManager.download(J,Q)}createMLTensorDownloader(J,Q){return async()=>{let X=await this.tensorManager.download(J);return eY(X,Q)}}registerMLTensor(J,Q,X,Y){let H=J4.get(X);if(!H)throw Error(`Unsupported ONNX data type: ${X}`);let W=this.tensorManager.registerTensor(J,Q,H,Y);return f0("verbose",()=>`[WebNN] registerMLTensor {tensor: ${Q}, dataType: ${H}, dimensions: ${Y}} -> {tensorId: ${W}}`),W}registerMLConstant(J,Q,X,Y,H,W){if(!W)throw Error("External mounted files are not available.");let G=J;J.startsWith("./")&&(G=J.substring(2));let j=W.get(G);if(!j)throw Error(`File with name ${G} not found in preloaded files.`);if(Q+X>j.byteLength)throw Error("Out of bounds: data offset and length exceed the external file data size.");let N=j.slice(Q,Q+X).buffer,V;switch(H.dataType){case"float32":V=new Float32Array(N);break;case"float16":V=new Uint16Array(N);break;case"int32":V=new Int32Array(N);break;case"uint32":V=new Uint32Array(N);break;case"int64":V=new BigInt64Array(N);break;case"uint64":V=new BigUint64Array(N);break;case"int8":V=new Int8Array(N);break;case"int4":case"uint4":case"uint8":V=new Uint8Array(N);break;default:throw Error(`Unsupported data type: ${H.dataType} in creating WebNN Constant from external data.`)}return f0("verbose",()=>`[WebNN] registerMLConstant {dataType: ${H.dataType}, shape: ${H.shape}}}`),Y.constant(H,V)}registerGraphInput(J){this.temporaryGraphInputs.push(J)}isGraphInput(J,Q){let X=this.sessionGraphInputs.get(J);return X?X.includes(Q):!1}flush(){}}}),cR={};e2(cR,{init:()=>dR});$z=Q0(()=>{z0(),Dz(),h6(),w0(),zz(),Q4=class J{constructor(Q,X,Y,H){this.module=Q,this.dataType=X,this.data=Y,this.dims=H}getFloat32Array(){if(this.dataType!==1)throw Error("Invalid data type");let Q=u.size(this.dims);return Q===0?new Float32Array:new Float32Array(this.module.HEAP8.buffer,this.data,Q)}getBigInt64Array(){if(this.dataType!==7)throw Error("Invalid data type");let Q=u.size(this.dims);return Q===0?new BigInt64Array:new BigInt64Array(this.module.HEAP8.buffer,this.data,Q)}getInt32Array(){if(this.dataType!==6)throw Error("Invalid data type");let Q=u.size(this.dims);return Q===0?new Int32Array:new Int32Array(this.module.HEAP8.buffer,this.data,Q)}getUint16Array(){if(this.dataType!==10&&this.dataType!==4)throw Error("Invalid data type");let Q=u.size(this.dims);return Q===0?new Uint16Array:new Uint16Array(this.module.HEAP8.buffer,this.data,Q)}reshape(Q){if(u.size(Q)!==u.size(this.dims))throw Error("Invalid new shape");return new J(this.module,this.dataType,this.data,Q)}},EL=class{constructor(J,Q,X){this.module=J,this.backend=Q,this.customDataOffset=0,this.customDataSize=0,this.adapterInfo=Q.adapterInfo,this.deviceInfo=Q.deviceInfo;let Y=J.PTR_SIZE,H=X/J.PTR_SIZE,W=Y===4?"i32":"i64";this.opKernelContext=Number(J.getValue(Y*H++,W));let G=Number(J.getValue(Y*H++,W));this.outputCount=Number(J.getValue(Y*H++,W)),this.customDataOffset=Number(J.getValue(Y*H++,"*")),this.customDataSize=Number(J.getValue(Y*H++,W));let j=[];for(let N=0;N<G;N++){let V=Number(J.getValue(Y*H++,W)),L=Number(J.getValue(Y*H++,"*")),B=Number(J.getValue(Y*H++,W)),U=[];for(let E=0;E<B;E++)U.push(Number(J.getValue(Y*H++,W)));j.push(new Q4(J,V,L,U))}this.inputs=j}get kernelCustomData(){return this.backend.currentKernelCustomData}get customDataBuffer(){return this.module.HEAPU8.subarray(this.customDataOffset,this.customDataOffset+this.customDataSize)}compute(J,Q){let X=Q?.inputs?.map((G)=>typeof G=="number"?this.inputs[G]:G)??this.inputs,Y=Q?.outputs??[],H=(G,j,N)=>new Q4(this.module,j,this.output(G,N),N),W=(G,j)=>{let N=l8(G,j);if(!N)throw Error(`Unsupported data type: ${G}`);let V=N>0?this.backend.gpuDataManager.create(N).id:0;return new Q4(this.module,G,V,j)};return this.backend.run(J,X,Y,H,W,this.outputCount)}output(J,Q){let X=this.module.stackSave();try{let Y=this.module.PTR_SIZE,H=Y===4?"i32":"i64",W=this.module.stackAlloc((1+Q.length)*Y);this.module.setValue(W,Q.length,H);for(let G=0;G<Q.length;G++)this.module.setValue(W+Y*(G+1),Q[G],H);return this.module._JsepOutput(this.opKernelContext,J,W)}catch(Y){throw Error(`Failed to generate kernel's output[${J}] with dims [${Q}]. If you are running with pre-allocated output, please make sure the output type/dims are correct. Error: ${Y}`)}finally{this.module.stackRestore(X)}}},dR=async(J,Q,X,Y)=>{let H=Q.jsepInit;if(!H)throw Error("Failed to initialize JSEP. The WebAssembly module is not built with JSEP support.");if(J==="webgpu"){let W=new lR;await W.initialize(X,Y),H("webgpu",[W,(G)=>W.alloc(Number(G)),(G)=>W.free(G),(G,j,N,V=!1)=>{if(V)f0("verbose",()=>`[WebGPU] jsepCopyGpuToGpu: src=${Number(G)}, dst=${Number(j)}, size=${Number(N)}`),W.memcpy(Number(G),Number(j));else{f0("verbose",()=>`[WebGPU] jsepCopyCpuToGpu: dataOffset=${Number(G)}, gpuDataId=${Number(j)}, size=${Number(N)}`);let L=Q.HEAPU8.subarray(Number(G>>>0),Number(G>>>0)+Number(N));W.upload(Number(j),L)}},async(G,j,N)=>{f0("verbose",()=>`[WebGPU] jsepCopyGpuToCpu: gpuDataId=${G}, dataOffset=${j}, size=${N}`),await W.download(Number(G),()=>Q.HEAPU8.subarray(Number(j)>>>0,Number(j+N)>>>0))},(G,j,N)=>W.createKernel(G,Number(j),N,Q.UTF8ToString(Q._JsepGetNodeName(Number(j)))),(G)=>W.releaseKernel(G),(G,j,N,V)=>{f0("verbose",()=>`[WebGPU] jsepRun: sessionHandle=${N}, kernel=${G}, contextDataOffset=${j}`);let L=new EL(Q,W,Number(j));return W.computeKernel(Number(G),L,V)},()=>W.captureBegin(),()=>W.captureEnd(),()=>W.replay()])}else{let W=new pR(X);H("webnn",[W,()=>W.reserveTensorId(),(G)=>W.releaseTensorId(G),async(G,j,N,V,L)=>W.ensureTensor(G,j,N,V,L),(G,j)=>{W.uploadTensor(G,j)},async(G,j)=>W.downloadTensor(G,j)])}}}),uR=Q0(()=>{wA(),kA(),z0(),u8(),sY(),rL(),DL=(J,Q)=>{V1()._OrtInit(J,Q)!==0&&p0("Can't initialize onnxruntime.")},NH=async(J)=>{DL(J.wasm.numThreads,G4(J.logLevel))},VH=async(J,Q)=>{{let X=($z(),q4(cR)).init;if(Q==="webgpu"){if(typeof navigator>"u"||!navigator.gpu)throw Error("WebGPU is not supported in current environment");let Y=J.webgpu.adapter;if(Y){if(typeof Y.limits!="object"||typeof Y.features!="object"||typeof Y.requestDevice!="function")throw Error("Invalid GPU adapter set in `env.webgpu.adapter`. It must be a GPUAdapter object.")}else{let H=J.webgpu.powerPreference;if(H!==void 0&&H!=="low-power"&&H!=="high-performance")throw Error(`Invalid powerPreference setting: "${H}"`);let W=J.webgpu.forceFallbackAdapter;if(W!==void 0&&typeof W!="boolean")throw Error(`Invalid forceFallbackAdapter setting: "${W}"`);if(Y=await navigator.gpu.requestAdapter({powerPreference:H,forceFallbackAdapter:W}),!Y)throw Error('Failed to get GPU adapter. You may need to enable flag "--enable-unsafe-webgpu" if you are using Chrome.')}await X("webgpu",V1(),J,Y)}if(Q==="webnn"){if(typeof navigator>"u"||!navigator.ml)throw Error("WebNN is not supported in current environment");await X("webnn",V1(),J)}}},s6=new Map,AL=(J)=>{let Q=V1(),X=Q.stackSave();try{let Y=Q.PTR_SIZE,H=Q.stackAlloc(2*Y);Q._OrtGetInputOutputCount(J,H,H+Y)!==0&&p0("Can't get session input/output count.");let W=Y===4?"i32":"i64";return[Number(Q.getValue(H,W)),Number(Q.getValue(H+Y,W))]}finally{Q.stackRestore(X)}},V4=(J)=>{let Q=V1(),X=Q._malloc(J.byteLength);if(X===0)throw Error(`Can't create a session. failed to allocate a buffer of size ${J.byteLength}.`);return Q.HEAPU8.set(J,X),[X,J.byteLength]},KH=async(J,Q)=>{let X,Y,H=V1();Array.isArray(J)?[X,Y]=J:J.buffer===H.HEAPU8.buffer?[X,Y]=[J.byteOffset,J.byteLength]:[X,Y]=V4(J);let W=0,G=0,j=0,N=[],V=[],L=[];try{if([G,N]=nL(Q),Q?.externalData&&H.mountExternalData){let D=[];for(let S of Q.externalData){let w=typeof S=="string"?S:S.path;D.push(rY(typeof S=="string"?S:S.data).then((k)=>{H.mountExternalData(w,k)}))}await Promise.all(D)}for(let D of Q?.executionProviders??[])if((typeof D=="string"?D:D.name)==="webnn"){if(H.shouldTransferToMLTensor=!1,typeof D!="string"){let S=D,w=S?.context,k=S?.gpuDevice,I=S?.deviceType,C=S?.powerPreference;w?H.currentContext=w:k?H.currentContext=await H.jsepCreateMLContext(k):H.currentContext=await H.jsepCreateMLContext({deviceType:I,powerPreference:C})}else H.currentContext=await H.jsepCreateMLContext();break}W=await H._OrtCreateSession(X,Y,G),W===0&&p0("Can't create a session."),H.jsepOnCreateSession?.(),H.currentContext&&(H.jsepRegisterMLContext(W,H.currentContext),H.currentContext=void 0,H.shouldTransferToMLTensor=!0);let[B,U]=AL(W),E=!!Q?.enableGraphCapture,R=[],A=[],P=[];for(let D=0;D<B;D++){let S=H._OrtGetInputName(W,D);S===0&&p0("Can't get an input name."),V.push(S),R.push(H.UTF8ToString(S))}for(let D=0;D<U;D++){let S=H._OrtGetOutputName(W,D);S===0&&p0("Can't get an output name."),L.push(S);let w=H.UTF8ToString(S);A.push(w);{if(E&&Q?.preferredOutputLocation===void 0){P.push("gpu-buffer");continue}let k=typeof Q?.preferredOutputLocation=="string"?Q.preferredOutputLocation:Q?.preferredOutputLocation?.[w]??"cpu";if(k!=="cpu"&&k!=="cpu-pinned"&&k!=="gpu-buffer"&&k!=="ml-tensor")throw Error(`Not supported preferred output location: ${k}.`);if(E&&k!=="gpu-buffer")throw Error(`Not supported preferred output location: ${k}. Only 'gpu-buffer' location is supported when enableGraphCapture is true.`);P.push(k)}}let z=null;return P.some((D)=>D==="gpu-buffer"||D==="ml-tensor")&&(j=H._OrtCreateBinding(W),j===0&&p0("Can't create IO binding."),z={handle:j,outputPreferredLocations:P,outputPreferredLocationsEncoded:P.map((D)=>wY(D))}),s6.set(W,[W,V,L,z,E,!1]),[W,R,A]}catch(B){throw V.forEach((U)=>H._OrtFree(U)),L.forEach((U)=>H._OrtFree(U)),j!==0&&H._OrtReleaseBinding(j)!==0&&p0("Can't release IO binding."),W!==0&&H._OrtReleaseSession(W)!==0&&p0("Can't release session."),B}finally{H._free(X),G!==0&&H._OrtReleaseSessionOptions(G)!==0&&p0("Can't release session options."),N.forEach((B)=>H._free(B)),H.unmountExternalData?.()}},MH=(J)=>{let Q=V1(),X=s6.get(J);if(!X)throw Error(`cannot release session. invalid session id: ${J}`);let[Y,H,W,G,j]=X;G&&(j&&Q._OrtClearBoundOutputs(G.handle)!==0&&p0("Can't clear bound outputs."),Q._OrtReleaseBinding(G.handle)!==0&&p0("Can't release IO binding.")),Q.jsepOnReleaseSession?.(J),H.forEach((N)=>Q._OrtFree(N)),W.forEach((N)=>Q._OrtFree(N)),Q._OrtReleaseSession(Y)!==0&&p0("Can't release session."),s6.delete(J)},PY=async(J,Q,X,Y,H,W=!1)=>{if(!J){Q.push(0);return}let G=V1(),j=G.PTR_SIZE,N=J[0],V=J[1],L=J[3],B=L,U,E;if(N==="string"&&(L==="gpu-buffer"||L==="ml-tensor"))throw Error("String tensor is not supported on GPU.");if(W&&L!=="gpu-buffer")throw Error(`External buffer must be provided for input/output index ${H} when enableGraphCapture is true.`);if(L==="gpu-buffer"){let P=J[2].gpuBuffer;E=l8(Y7(N),V);let z=G.jsepRegisterBuffer;if(!z)throw Error('Tensor location "gpu-buffer" is not supported without using WebGPU.');U=z(Y,H,P,E)}else if(L==="ml-tensor"){let P=J[2].mlTensor;E=l8(Y7(N),V);let z=G.jsepRegisterMLTensor;if(!z)throw Error('Tensor location "ml-tensor" is not supported without using WebNN.');U=z(Y,P,Y7(N),V)}else{let P=J[2];if(Array.isArray(P)){E=j*P.length,U=G._malloc(E),X.push(U);for(let z=0;z<P.length;z++){if(typeof P[z]!="string")throw TypeError(`tensor data at index ${z} is not a string`);G.setValue(U+z*j,A1(P[z],X),"*")}}else{let z=G.jsepIsGraphInput;if(N!=="string"&&z){let D=G._OrtGetInputName(Y,H),S=G.UTF8ToString(D);if(z(Y,S)){let w=Y7(N);E=l8(w,V),B="ml-tensor";let{jsepCreateTemporaryTensor:k,jsepUploadTensor:I}=G;if(!k||!I)throw Error('Tensor location "ml-tensor" is not supported without using WebNN.');let C=await k(Y,w,V);I(C,new Uint8Array(P.buffer,P.byteOffset,P.byteLength)),U=C}else E=P.byteLength,U=G._malloc(E),X.push(U),G.HEAPU8.set(new Uint8Array(P.buffer,P.byteOffset,E),U)}else E=P.byteLength,U=G._malloc(E),X.push(U),G.HEAPU8.set(new Uint8Array(P.buffer,P.byteOffset,E),U)}}let R=G.stackSave(),A=G.stackAlloc(4*V.length);try{V.forEach((z,D)=>G.setValue(A+D*j,z,j===4?"i32":"i64"));let P=G._OrtCreateTensor(Y7(N),U,E,A,V.length,wY(B));P===0&&p0(`Can't create tensor for input/output. session=${Y}, index=${H}.`),Q.push(P)}finally{G.stackRestore(R)}},BH=async(J,Q,X,Y,H,W)=>{let G=V1(),j=G.PTR_SIZE,N=s6.get(J);if(!N)throw Error(`cannot run inference. invalid session id: ${J}`);let V=N[0],L=N[1],B=N[2],U=N[3],E=N[4],R=N[5],A=Q.length,P=Y.length,z=0,D=[],S=[],w=[],k=[],I=G.stackSave(),C=G.stackAlloc(A*j),T=G.stackAlloc(A*j),g=G.stackAlloc(P*j),m=G.stackAlloc(P*j);try{[z,D]=iL(W);for(let h=0;h<A;h++)await PY(X[h],S,k,J,Q[h],E);for(let h=0;h<P;h++)await PY(H[h],w,k,J,A+Y[h],E);for(let h=0;h<A;h++)G.setValue(C+h*j,S[h],"*"),G.setValue(T+h*j,L[Q[h]],"*");for(let h=0;h<P;h++)G.setValue(g+h*j,w[h],"*"),G.setValue(m+h*j,B[Y[h]],"*");if(U&&!R){let{handle:h,outputPreferredLocations:W0,outputPreferredLocationsEncoded:j0}=U;if(L.length!==A)throw Error(`input count from feeds (${A}) is expected to be always equal to model's input count (${L.length}).`);for(let o=0;o<A;o++){let G0=Q[o];await G._OrtBindInput(h,L[G0],S[o])!==0&&p0(`Can't bind input[${o}] for session=${J}.`)}for(let o=0;o<P;o++){let G0=Y[o];H[o]?.[3]?G._OrtBindOutput(h,B[G0],w[o],0)!==0&&p0(`Can't bind pre-allocated output[${o}] for session=${J}.`):G._OrtBindOutput(h,B[G0],0,j0[G0])!==0&&p0(`Can't bind output[${o}] to ${W0[o]} for session=${J}.`)}s6.set(J,[V,L,B,U,E,!0])}G.jsepOnRunStart?.(V);let l;U?l=await G._OrtRunWithBinding(V,U.handle,P,g,z):l=await G._OrtRun(V,T,C,A,m,P,g,z),l!==0&&p0("failed to call OrtRun().");let t=[];for(let h=0;h<P;h++){let W0=Number(G.getValue(g+h*j,"*"));if(W0===w[h]){t.push(H[h]);continue}let j0=G.stackSave(),o=G.stackAlloc(4*j),G0=!1,F0,s=0;try{G._OrtGetTensorData(W0,o,o+j,o+2*j,o+3*j)!==0&&p0(`Can't access output tensor data on index ${h}.`);let N0=j===4?"i32":"i64",f=Number(G.getValue(o,N0));s=G.getValue(o+j,"*");let p=G.getValue(o+j*2,"*"),v=Number(G.getValue(o+j*3,N0)),r=[];for(let h0=0;h0<v;h0++)r.push(Number(G.getValue(p+h0*j,N0)));G._OrtFree(p)!==0&&p0("Can't free memory for tensor dims.");let k0=r.reduce((h0,_0)=>h0*_0,1);F0=g8(f);let o0=U?.outputPreferredLocations[Y[h]];if(F0==="string"){if(o0==="gpu-buffer"||o0==="ml-tensor")throw Error("String tensor is not supported on GPU.");let h0=[];for(let _0=0;_0<k0;_0++){let q1=G.getValue(s+_0*j,"*"),u0=G.getValue(s+(_0+1)*j,"*"),D6=_0===k0-1?void 0:u0-q1;h0.push(G.UTF8ToString(q1,D6))}t.push([F0,r,h0,"cpu"])}else if(o0==="gpu-buffer"&&k0>0){let h0=G.jsepGetBuffer;if(!h0)throw Error('preferredLocation "gpu-buffer" is not supported without using WebGPU.');let _0=h0(s),q1=l8(f,k0);if(q1===void 0||!iY(F0))throw Error(`Unsupported data type: ${F0}`);G0=!0,t.push([F0,r,{gpuBuffer:_0,download:G.jsepCreateDownloader(_0,q1,F0),dispose:()=>{G._OrtReleaseTensor(W0)!==0&&p0("Can't release tensor.")}},"gpu-buffer"])}else if(o0==="ml-tensor"&&k0>0){let h0=G.jsepEnsureTensor;if(!h0)throw Error('preferredLocation "ml-tensor" is not supported without using WebNN.');if(l8(f,k0)===void 0||!nY(F0))throw Error(`Unsupported data type: ${F0}`);let _0=await h0(J,s,f,r,!1);G0=!0,t.push([F0,r,{mlTensor:_0,download:G.jsepCreateMLTensorDownloader(s,F0),dispose:()=>{G.jsepReleaseTensorId(s),G._OrtReleaseTensor(W0)}},"ml-tensor"])}else{let h0=aY(F0),_0=new h0(k0);new Uint8Array(_0.buffer,_0.byteOffset,_0.byteLength).set(G.HEAPU8.subarray(s,s+_0.byteLength)),t.push([F0,r,_0,"cpu"])}}finally{G.stackRestore(j0),F0==="string"&&s&&G._free(s),G0||G._OrtReleaseTensor(W0),G.jsepOnRunEnd?.(V)}}return U&&!E&&(G._OrtClearBoundOutputs(U.handle)!==0&&p0("Can't clear bound outputs."),s6.set(J,[V,L,B,U,E,!1])),t}finally{G.stackRestore(I),S.forEach((l)=>G._OrtReleaseTensor(l)),w.forEach((l)=>G._OrtReleaseTensor(l)),k.forEach((l)=>G._free(l)),z!==0&&G._OrtReleaseRunOptions(z),D.forEach((l)=>G._free(l))}},LH=(J)=>{let Q=V1(),X=s6.get(J);if(!X)throw Error("invalid session id");let Y=X[0],H=Q._OrtEndProfiling(Y);H===0&&p0("Can't get an profile file name."),Q._OrtFree(H)},UH=(J)=>{let Q=[];for(let X of J){let Y=X[2];!Array.isArray(Y)&&"buffer"in Y&&Q.push(Y.buffer)}return Q}}),eR=Q0(()=>{M6(),uR(),u8(),uY(),a6=()=>!!i0.wasm.proxy&&typeof document<"u",X7=!1,u2=!1,o2=!1,Y4=new Map,f8=(J,Q)=>{let X=Y4.get(J);X?X.push(Q):Y4.set(J,[Q])},h8=()=>{if(X7||!u2||o2||!p1)throw Error("worker not ready")},zL=(J)=>{switch(J.data.type){case"init-wasm":X7=!1,J.data.err?(o2=!0,SY[1](J.data.err)):(u2=!0,SY[0]()),X4&&(URL.revokeObjectURL(X4),X4=void 0);break;case"init-ep":case"copy-from":case"create":case"release":case"run":case"end-profiling":{let Q=Y4.get(J.data.type);J.data.err?Q.shift()[1](J.data.err):Q.shift()[0](J.data.out);break}default:}},oR=async()=>{if(!u2){if(X7)throw Error("multiple calls to 'initWasm()' detected.");if(o2)throw Error("previous call to 'initWasm()' failed.");if(X7=!0,a6())return new Promise((J,Q)=>{p1?.terminate(),sL().then(([X,Y])=>{try{p1=Y,p1.onerror=(W)=>Q(W),p1.onmessage=zL,SY=[J,Q];let H={type:"init-wasm",in:i0};!H.in.wasm.wasmPaths&&(X||import.meta.url?.startsWith("file:"))&&(H.in.wasm.wasmPaths={wasm:new URL("ort-wasm-simd-threaded.jsep.wasm",import.meta.url).href}),p1.postMessage(H),X4=X}catch(H){Q(H)}},Q)});try{await oY(i0.wasm),await NH(i0),u2=!0}catch(J){throw o2=!0,J}finally{X7=!1}}},sR=async(J)=>{if(a6())return h8(),new Promise((Q,X)=>{f8("init-ep",[Q,X]);let Y={type:"init-ep",in:{epName:J,env:i0}};p1.postMessage(Y)});await VH(i0,J)},aR=async(J)=>a6()?(h8(),new Promise((Q,X)=>{f8("copy-from",[Q,X]);let Y={type:"copy-from",in:{buffer:J}};p1.postMessage(Y,[J.buffer])})):V4(J),iR=async(J,Q)=>{if(a6()){if(Q?.preferredOutputLocation)throw Error('session option "preferredOutputLocation" is not supported for proxy.');return h8(),new Promise((X,Y)=>{f8("create",[X,Y]);let H={type:"create",in:{model:J,options:{...Q}}},W=[];J instanceof Uint8Array&&W.push(J.buffer),p1.postMessage(H,W)})}else return KH(J,Q)},nR=async(J)=>{if(a6())return h8(),new Promise((Q,X)=>{f8("release",[Q,X]);let Y={type:"release",in:J};p1.postMessage(Y)});MH(J)},rR=async(J,Q,X,Y,H,W)=>{if(a6()){if(X.some((G)=>G[3]!=="cpu"))throw Error("input tensor on GPU is not supported for proxy.");if(H.some((G)=>G))throw Error("pre-allocated output tensor is not supported for proxy.");return h8(),new Promise((G,j)=>{f8("run",[G,j]);let N=X,V={type:"run",in:{sessionId:J,inputIndices:Q,inputs:N,outputIndices:Y,options:W}};p1.postMessage(V,UH(N))})}else return BH(J,Q,X,Y,H,W)},tR=async(J)=>{if(a6())return h8(),new Promise((Q,X)=>{f8("end-profiling",[Q,X]);let Y={type:"end-profiling",in:J};p1.postMessage(Y)});LH(J)}}),Pz=Q0(()=>{M6(),eR(),z0(),dY(),rL(),ZY=(J,Q)=>{switch(J.location){case"cpu":return[J.type,J.dims,J.data,"cpu"];case"gpu-buffer":return[J.type,J.dims,{gpuBuffer:J.gpuBuffer},"gpu-buffer"];case"ml-tensor":return[J.type,J.dims,{mlTensor:J.mlTensor},"ml-tensor"];default:throw Error(`invalid data location: ${J.location} for ${Q()}`)}},$L=(J)=>{switch(J[3]){case"cpu":return new V6(J[0],J[2],J[1]);case"gpu-buffer":{let Q=J[0];if(!iY(Q))throw Error(`not supported data type: ${Q} for deserializing GPU tensor`);let{gpuBuffer:X,download:Y,dispose:H}=J[2];return V6.fromGpuBuffer(X,{dataType:Q,dims:J[1],download:Y,dispose:H})}case"ml-tensor":{let Q=J[0];if(!nY(Q))throw Error(`not supported data type: ${Q} for deserializing MLTensor tensor`);let{mlTensor:X,download:Y,dispose:H}=J[2];return V6.fromMLTensor(X,{dataType:Q,dims:J[1],download:Y,dispose:H})}default:throw Error(`invalid data location: ${J[3]}`)}},JE=class{async fetchModelAndCopyToWasmMemory(J){return aR(await rY(J))}async loadModel(J,Q){K6();let X;typeof J=="string"?X=await this.fetchModelAndCopyToWasmMemory(J):X=J,[this.sessionId,this.inputNames,this.outputNames]=await iR(X,Q),d1()}async dispose(){return nR(this.sessionId)}async run(J,Q,X){K6();let Y=[],H=[];Object.entries(J).forEach((B)=>{let U=B[0],E=B[1],R=this.inputNames.indexOf(U);if(R===-1)throw Error(`invalid input '${U}'`);Y.push(E),H.push(R)});let W=[],G=[];Object.entries(Q).forEach((B)=>{let U=B[0],E=B[1],R=this.outputNames.indexOf(U);if(R===-1)throw Error(`invalid output '${U}'`);W.push(E),G.push(R)});let j=Y.map((B,U)=>ZY(B,()=>`input "${this.inputNames[H[U]]}"`)),N=W.map((B,U)=>B?ZY(B,()=>`output "${this.outputNames[G[U]]}"`):null),V=await rR(this.sessionId,H,j,G,N,X),L={};for(let B=0;B<V.length;B++)L[this.outputNames[G[B]]]=W[B]??$L(V[B]);return d1(),L}startProfiling(){}endProfiling(){tR(this.sessionId)}}}),QE={};e2(QE,{OnnxruntimeWebAssemblyBackend:()=>lY,initializeFlags:()=>gY,wasmBackend:()=>XE});Sz=Q0(()=>{M6(),eR(),Pz(),gY=()=>{if((typeof i0.wasm.initTimeout!="number"||i0.wasm.initTimeout<0)&&(i0.wasm.initTimeout=0),i0.wasm.simd===!1&&console.warn('Deprecated property "env.wasm.simd" is set to false. non-SIMD build is no longer provided, and this setting will be ignored.'),typeof i0.wasm.proxy!="boolean"&&(i0.wasm.proxy=!1),typeof i0.wasm.trace!="boolean"&&(i0.wasm.trace=!1),typeof i0.wasm.numThreads!="number"||!Number.isInteger(i0.wasm.numThreads)||i0.wasm.numThreads<=0)if(typeof self<"u"&&!self.crossOriginIsolated)i0.wasm.numThreads=1;else{let J=typeof navigator>"u"?NA("node:os").cpus().length:navigator.hardwareConcurrency;i0.wasm.numThreads=Math.min(4,Math.ceil((J||1)/2))}},lY=class{async init(J){gY(),await oR(),await sR(J)}async createInferenceSessionHandler(J,Q){let X=new JE;return await X.loadModel(J,Q),Promise.resolve(X)}},XE=new lY});M6();M6();M6();wz=mL;{let J=(Sz(),q4(QE)).wasmBackend;m8("webgpu",J,5),m8("webnn",J,5),m8("cpu",J,10),m8("wasm",J,10)}Object.defineProperty(i0.versions,"web",{value:Zz,enumerable:!0})});var w4={};oQ(w4,{segmentForeground:()=>yE,removeForeground:()=>uS,removeBackground:()=>dS,preload:()=>cS,applySegmentationMask:()=>sS,alphamask:()=>oS});var{create:kz,defineProperty:ME,getOwnPropertyDescriptor:Cz,getOwnPropertyNames:BE,getPrototypeOf:Iz}=Object,_z=Object.prototype.hasOwnProperty,SH=(J,Q)=>function(){return Q||(0,J[BE(J)[0]])((Q={exports:{}}).exports,Q),Q.exports},bz=(J,Q,X,Y)=>{if(Q&&typeof Q==="object"||typeof Q==="function"){for(let H of BE(Q))if(!_z.call(J,H)&&H!==X)ME(J,H,{get:()=>Q[H],enumerable:!(Y=Cz(Q,H))||Y.enumerable})}return J},A4=(J,Q,X)=>(X=J!=null?kz(Iz(J)):{},bz(Q||!J||!J.__esModule?ME(X,"default",{value:J,enumerable:!0}):X,J)),vz=SH({"../../node_modules/.pnpm/iota-array@1.0.0/node_modules/iota-array/iota.js"(J,Q){function X(Y){var H=Array(Y);for(var W=0;W<Y;++W)H[W]=W;return H}Q.exports=X}}),Tz=SH({"../../node_modules/.pnpm/is-buffer@1.1.6/node_modules/is-buffer/index.js"(J,Q){Q.exports=function(H){return H!=null&&(X(H)||Y(H)||!!H._isBuffer)};function X(H){return!!H.constructor&&typeof H.constructor.isBuffer==="function"&&H.constructor.isBuffer(H)}function Y(H){return typeof H.readFloatLE==="function"&&typeof H.slice==="function"&&X(H.slice(0,0))}}}),z4=SH({"../../node_modules/.pnpm/ndarray@1.0.19/node_modules/ndarray/ndarray.js"(J,Q){var X=vz(),Y=Tz(),H=typeof Float64Array<"u";function W(B,U){return B[0]-U[0]}function G(){var B=this.stride,U=Array(B.length),E;for(E=0;E<U.length;++E)U[E]=[Math.abs(B[E]),E];U.sort(W);var R=Array(U.length);for(E=0;E<R.length;++E)R[E]=U[E][1];return R}function j(B,U){var E=["View",U,"d",B].join("");if(U<0)E="View_Nil"+B;var R=B==="generic";if(U===-1){var A="function "+E+"(a){this.data=a;};var proto="+E+".prototype;proto.dtype='"+B+"';proto.index=function(){return -1};proto.size=0;proto.dimension=-1;proto.shape=proto.stride=proto.order=[];proto.lo=proto.hi=proto.transpose=proto.step=function(){return new "+E+"(this.data);};proto.get=proto.set=function(){};proto.pick=function(){return null};return function construct_"+E+"(a){return new "+E+"(a);}",m=Function(A);return m()}else if(U===0){var A="function "+E+"(a,d) {this.data = a;this.offset = d};var proto="+E+".prototype;proto.dtype='"+B+"';proto.index=function(){return this.offset};proto.dimension=0;proto.size=1;proto.shape=proto.stride=proto.order=[];proto.lo=proto.hi=proto.transpose=proto.step=function "+E+"_copy() {return new "+E+"(this.data,this.offset)};proto.pick=function "+E+"_pick(){return TrivialArray(this.data);};proto.valueOf=proto.get=function "+E+"_get(){return "+(R?"this.data.get(this.offset)":"this.data[this.offset]")+"};proto.set=function "+E+"_set(v){return "+(R?"this.data.set(this.offset,v)":"this.data[this.offset]=v")+"};return function construct_"+E+"(a,b,c,d){return new "+E+"(a,d)}",m=Function("TrivialArray",A);return m(V[B][0])}var A=["'use strict'"],P=X(U),z=P.map(function(l){return"i"+l}),D="this.offset+"+P.map(function(l){return"this.stride["+l+"]*i"+l}).join("+"),S=P.map(function(l){return"b"+l}).join(","),w=P.map(function(l){return"c"+l}).join(",");if(A.push("function "+E+"(a,"+S+","+w+",d){this.data=a","this.shape=["+S+"]","this.stride=["+w+"]","this.offset=d|0}","var proto="+E+".prototype","proto.dtype='"+B+"'","proto.dimension="+U),A.push("Object.defineProperty(proto,'size',{get:function "+E+"_size(){return "+P.map(function(l){return"this.shape["+l+"]"}).join("*"),"}})"),U===1)A.push("proto.order=[0]");else if(A.push("Object.defineProperty(proto,'order',{get:"),U<4){if(A.push("function "+E+"_order(){"),U===2)A.push("return (Math.abs(this.stride[0])>Math.abs(this.stride[1]))?[1,0]:[0,1]}})");else if(U===3)A.push("var s0=Math.abs(this.stride[0]),s1=Math.abs(this.stride[1]),s2=Math.abs(this.stride[2]);if(s0>s1){if(s1>s2){return [2,1,0];}else if(s0>s2){return [1,2,0];}else{return [1,0,2];}}else if(s0>s2){return [2,0,1];}else if(s2>s1){return [0,1,2];}else{return [0,2,1];}}})")}else A.push("ORDER})");if(A.push("proto.set=function "+E+"_set("+z.join(",")+",v){"),R)A.push("return this.data.set("+D+",v)}");else A.push("return this.data["+D+"]=v}");if(A.push("proto.get=function "+E+"_get("+z.join(",")+"){"),R)A.push("return this.data.get("+D+")}");else A.push("return this.data["+D+"]}");A.push("proto.index=function "+E+"_index(",z.join(),"){return "+D+"}"),A.push("proto.hi=function "+E+"_hi("+z.join(",")+"){return new "+E+"(this.data,"+P.map(function(l){return["(typeof i",l,"!=='number'||i",l,"<0)?this.shape[",l,"]:i",l,"|0"].join("")}).join(",")+","+P.map(function(l){return"this.stride["+l+"]"}).join(",")+",this.offset)}");var k=P.map(function(l){return"a"+l+"=this.shape["+l+"]"}),I=P.map(function(l){return"c"+l+"=this.stride["+l+"]"});A.push("proto.lo=function "+E+"_lo("+z.join(",")+"){var b=this.offset,d=0,"+k.join(",")+","+I.join(","));for(var C=0;C<U;++C)A.push("if(typeof i"+C+"==='number'&&i"+C+">=0){d=i"+C+"|0;b+=c"+C+"*d;a"+C+"-=d}");A.push("return new "+E+"(this.data,"+P.map(function(l){return"a"+l}).join(",")+","+P.map(function(l){return"c"+l}).join(",")+",b)}"),A.push("proto.step=function "+E+"_step("+z.join(",")+"){var "+P.map(function(l){return"a"+l+"=this.shape["+l+"]"}).join(",")+","+P.map(function(l){return"b"+l+"=this.stride["+l+"]"}).join(",")+",c=this.offset,d=0,ceil=Math.ceil");for(var C=0;C<U;++C)A.push("if(typeof i"+C+"==='number'){d=i"+C+"|0;if(d<0){c+=b"+C+"*(a"+C+"-1);a"+C+"=ceil(-a"+C+"/d)}else{a"+C+"=ceil(a"+C+"/d)}b"+C+"*=d}");A.push("return new "+E+"(this.data,"+P.map(function(l){return"a"+l}).join(",")+","+P.map(function(l){return"b"+l}).join(",")+",c)}");var T=Array(U),g=Array(U);for(var C=0;C<U;++C)T[C]="a[i"+C+"]",g[C]="b[i"+C+"]";A.push("proto.transpose=function "+E+"_transpose("+z+"){"+z.map(function(l,t){return l+"=("+l+"===undefined?"+t+":"+l+"|0)"}).join(";"),"var a=this.shape,b=this.stride;return new "+E+"(this.data,"+T.join(",")+","+g.join(",")+",this.offset)}"),A.push("proto.pick=function "+E+"_pick("+z+"){var a=[],b=[],c=this.offset");for(var C=0;C<U;++C)A.push("if(typeof i"+C+"==='number'&&i"+C+">=0){c=(c+this.stride["+C+"]*i"+C+")|0}else{a.push(this.shape["+C+"]);b.push(this.stride["+C+"])}");A.push("var ctor=CTOR_LIST[a.length+1];return ctor(this.data,a,b,c)}"),A.push("return function construct_"+E+"(data,shape,stride,offset){return new "+E+"(data,"+P.map(function(l){return"shape["+l+"]"}).join(",")+","+P.map(function(l){return"stride["+l+"]"}).join(",")+",offset)}");var m=Function("CTOR_LIST","ORDER",A.join(`
`));return m(V[B],G)}function N(B){if(Y(B))return"buffer";if(H)switch(Object.prototype.toString.call(B)){case"[object Float64Array]":return"float64";case"[object Float32Array]":return"float32";case"[object Int8Array]":return"int8";case"[object Int16Array]":return"int16";case"[object Int32Array]":return"int32";case"[object Uint8Array]":return"uint8";case"[object Uint16Array]":return"uint16";case"[object Uint32Array]":return"uint32";case"[object Uint8ClampedArray]":return"uint8_clamped";case"[object BigInt64Array]":return"bigint64";case"[object BigUint64Array]":return"biguint64"}if(Array.isArray(B))return"array";return"generic"}var V={float32:[],float64:[],int8:[],int16:[],int32:[],uint8:[],uint16:[],uint32:[],array:[],uint8_clamped:[],bigint64:[],biguint64:[],buffer:[],generic:[]};function L(B,U,E,R){if(B===void 0){var w=V.array[0];return w([])}else if(typeof B==="number")B=[B];if(U===void 0)U=[B.length];var A=U.length;if(E===void 0){E=Array(A);for(var P=A-1,z=1;P>=0;--P)E[P]=z,z*=U[P]}if(R===void 0){R=0;for(var P=0;P<A;++P)if(E[P]<0)R-=(U[P]-1)*E[P]}var D=N(B),S=V[D];while(S.length<=A+1)S.push(j(D,S.length-1));var w=S[A+1];return w(B,U,E,R)}Q.exports=L}}),xz=typeof global=="object"&&global&&global.Object===Object&&global,fz=xz,hz=typeof self=="object"&&self&&self.Object===Object&&self,yz=fz||hz||Function("return this")(),ZH=yz,gz=ZH.Symbol,K4=gz,LE=Object.prototype,lz=LE.hasOwnProperty,mz=LE.toString,J5=K4?K4.toStringTag:void 0;function pz(J){var Q=lz.call(J,J5),X=J[J5];try{J[J5]=void 0;var Y=!0}catch(W){}var H=mz.call(J);if(Y)if(Q)J[J5]=X;else delete J[J5];return H}var cz=pz,dz=Object.prototype,uz=dz.toString;function oz(J){return uz.call(J)}var sz=oz,az="[object Null]",iz="[object Undefined]",qE=K4?K4.toStringTag:void 0;function nz(J){if(J==null)return J===void 0?iz:az;return qE&&qE in Object(J)?cz(J):sz(J)}var rz=nz;function tz(J){var Q=typeof J;return J!=null&&(Q=="object"||Q=="function")}var UE=tz,ez="[object AsyncFunction]",J$="[object Function]",Q$="[object GeneratorFunction]",X$="[object Proxy]";function Y$(J){if(!UE(J))return!1;var Q=rz(J);return Q==J$||Q==Q$||Q==ez||Q==X$}var H$=Y$,q$=ZH["__core-js_shared__"],OH=q$,WE=function(){var J=/[^.]+$/.exec(OH&&OH.keys&&OH.keys.IE_PROTO||"");return J?"Symbol(src)_1."+J:""}();function W$(J){return!!WE&&WE in J}var G$=W$,j$=Function.prototype,F$=j$.toString;function N$(J){if(J!=null){try{return F$.call(J)}catch(Q){}try{return J+""}catch(Q){}}return""}var V$=N$,K$=/[\\^$.*+?()[\]{}|]/g,M$=/^\[object .+?Constructor\]$/,B$=Function.prototype,L$=Object.prototype,U$=B$.toString,O$=L$.hasOwnProperty,R$=RegExp("^"+U$.call(O$).replace(K$,"\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,"$1.*?")+"$");function E$(J){if(!UE(J)||G$(J))return!1;var Q=H$(J)?R$:M$;return Q.test(V$(J))}var D$=E$;function A$(J,Q){return J==null?void 0:J[Q]}var z$=A$;function $$(J,Q){var X=z$(J,Q);return D$(X)?X:void 0}var OE=$$,P$=OE(Object,"create"),H5=P$;function S$(){this.__data__=H5?H5(null):{},this.size=0}var Z$=S$;function w$(J){var Q=this.has(J)&&delete this.__data__[J];return this.size-=Q?1:0,Q}var k$=w$,C$="__lodash_hash_undefined__",I$=Object.prototype,_$=I$.hasOwnProperty;function b$(J){var Q=this.__data__;if(H5){var X=Q[J];return X===C$?void 0:X}return _$.call(Q,J)?Q[J]:void 0}var v$=b$,T$=Object.prototype,x$=T$.hasOwnProperty;function f$(J){var Q=this.__data__;return H5?Q[J]!==void 0:x$.call(Q,J)}var h$=f$,y$="__lodash_hash_undefined__";function g$(J,Q){var X=this.__data__;return this.size+=this.has(J)?0:1,X[J]=H5&&Q===void 0?y$:Q,this}var l$=g$;function M7(J){var Q=-1,X=J==null?0:J.length;this.clear();while(++Q<X){var Y=J[Q];this.set(Y[0],Y[1])}}M7.prototype.clear=Z$;M7.prototype.delete=k$;M7.prototype.get=v$;M7.prototype.has=h$;M7.prototype.set=l$;var GE=M7;function m$(){this.__data__=[],this.size=0}var p$=m$;function c$(J,Q){return J===Q||J!==J&&Q!==Q}var d$=c$;function u$(J,Q){var X=J.length;while(X--)if(d$(J[X][0],Q))return X;return-1}var $4=u$,o$=Array.prototype,s$=o$.splice;function a$(J){var Q=this.__data__,X=$4(Q,J);if(X<0)return!1;var Y=Q.length-1;if(X==Y)Q.pop();else s$.call(Q,X,1);return--this.size,!0}var i$=a$;function n$(J){var Q=this.__data__,X=$4(Q,J);return X<0?void 0:Q[X][1]}var r$=n$;function t$(J){return $4(this.__data__,J)>-1}var e$=t$;function JP(J,Q){var X=this.__data__,Y=$4(X,J);if(Y<0)++this.size,X.push([J,Q]);else X[Y][1]=Q;return this}var QP=JP;function B7(J){var Q=-1,X=J==null?0:J.length;this.clear();while(++Q<X){var Y=J[Q];this.set(Y[0],Y[1])}}B7.prototype.clear=p$;B7.prototype.delete=i$;B7.prototype.get=r$;B7.prototype.has=e$;B7.prototype.set=QP;var XP=B7,YP=OE(ZH,"Map"),HP=YP;function qP(){this.size=0,this.__data__={hash:new GE,map:new(HP||XP),string:new GE}}var WP=qP;function GP(J){var Q=typeof J;return Q=="string"||Q=="number"||Q=="symbol"||Q=="boolean"?J!=="__proto__":J===null}var jP=GP;function FP(J,Q){var X=J.__data__;return jP(Q)?X[typeof Q=="string"?"string":"hash"]:X.map}var P4=FP;function NP(J){var Q=P4(this,J).delete(J);return this.size-=Q?1:0,Q}var VP=NP;function KP(J){return P4(this,J).get(J)}var MP=KP;function BP(J){return P4(this,J).has(J)}var LP=BP;function UP(J,Q){var X=P4(this,J),Y=X.size;return X.set(J,Q),this.size+=X.size==Y?0:1,this}var OP=UP;function L7(J){var Q=-1,X=J==null?0:J.length;this.clear();while(++Q<X){var Y=J[Q];this.set(Y[0],Y[1])}}L7.prototype.clear=WP;L7.prototype.delete=VP;L7.prototype.get=MP;L7.prototype.has=LP;L7.prototype.set=OP;var RE=L7,RP="Expected a function";function wH(J,Q){if(typeof J!="function"||Q!=null&&typeof Q!="function")throw TypeError(RP);var X=function(){var Y=arguments,H=Q?Q.apply(this,Y):Y[0],W=X.cache;if(W.has(H))return W.get(H);var G=J.apply(this,Y);return X.cache=W.set(H,G)||W,G};return X.cache=new(wH.Cache||RE),X}wH.Cache=RE;var EP=wH,kH=A4(z4()),EE=class J{constructor(Q,X){this.type="application/octet-stream",this.params={},this.type=Q,this.params=X}toString(){let Q=[];for(let X in this.params){let Y=this.params[X];Q.push(`${X}=${Y}`)}return[this.type,...Q].join(";")}static create(Q,X){return new J(Q,X)}isIdentical(Q){return this.type===Q.type&&this.params===Q.params}isEqual(Q){return this.type===Q.type}static fromString(Q){let[X,...Y]=Q.split(";"),H={};for(let W of Y){let[G,j]=W.split("=");H[G.trim()]=j.trim()}return new J(X,H)}},RH=A4(z4());async function DP(J){let Q=EE.fromString(J.type);switch(Q.type){case"image/x-alpha8":{let X=parseInt(Q.params.width),Y=parseInt(Q.params.height);return(0,RH.default)(new Uint8Array(await J.arrayBuffer()),[Y,X,1])}case"image/x-rgba8":{let X=parseInt(Q.params.width),Y=parseInt(Q.params.height);return(0,RH.default)(new Uint8Array(await J.arrayBuffer()),[Y,X,4])}case"application/octet-stream":case"image/png":case"image/jpeg":case"image/jpg":case"image/webp":{let X=await createImageBitmap(J),Y=$P(X);return(0,RH.default)(new Uint8Array(Y.data),[Y.height,Y.width,4])}default:throw Error(`Invalid format: ${Q.type} with params: ${Q.params}`)}}async function S4(J,Q=0.8,X="image/png"){let[Y,H,W]=J.shape;switch(X){case"image/x-alpha8":case"image/x-rgba8":{let N=EE.create(X,{width:H.toString(),height:Y.toString()});return new Blob([J.data],{type:N.toString()})}case"image/png":case"image/jpeg":case"image/webp":{let N=new ImageData(new Uint8ClampedArray(J.data),H,Y);var G=DE(N.width,N.height),j=G.getContext("2d");return j.putImageData(N,0,0),G.convertToBlob({quality:Q,type:X})}default:throw Error(`Invalid format: ${X}`)}}function AP(J){return new RegExp("^(?:[a-z+]+:)?//","i").test(J)}function zP(J,Q){if(AP(J))return J;else return new URL(J,Q).href}function $P(J){var Q=DE(J.width,J.height),X=Q.getContext("2d");return X.drawImage(J,0,0),X.getImageData(0,0,Q.width,Q.height)}function PP(J){if(typeof Uint8Array<"u")return new Uint8Array(J);else if(typeof Uint8ClampedArray<"u")return new Uint8ClampedArray(J);else if(typeof Uint16Array<"u")return new Uint16Array(J);else if(typeof Uint32Array<"u")return new Uint32Array(J);else if(typeof Float32Array<"u")return new Float32Array(J);else if(typeof Float64Array<"u")return new Float64Array(J);else throw Error("TypedArray not supported")}function DH(J,Q,X,Y=!1){let[H,W,G]=J.shape,j=W/Q,N=H/X;if(Y)j=N=Math.max(j,N)>1?Math.max(j,N):Math.min(j,N);let V=(0,kH.default)(PP(G*Q*X),[X,Q,G]);for(let L=0;L<X;L++)for(let B=0;B<Q;B++){let U=B*j,E=L*N,R=Math.max(Math.floor(U),0),A=Math.min(Math.ceil(U),W-1),P=Math.max(Math.floor(E),0),z=Math.min(Math.ceil(E),H-1),D=U-R,S=E-P;for(let w=0;w<G;w++){let k=J.get(P,R,w),I=J.get(P,A,w),C=J.get(z,R,w),T=J.get(z,A,w),g=(1-D)*(1-S)*k+D*(1-S)*I+(1-D)*S*C+D*S*T;V.set(L,B,w,g)}}return V}function SP(J,Q=[128,128,128],X=[256,256,256]){var Y=J.data;let[H,W,G]=J.shape,j=H*W,N=new Float32Array(3*j);for(let V=0,L=0;V<Y.length;V+=4,L+=1)N[L]=(Y[V]-Q[0])/X[0],N[L+j]=(Y[V+1]-Q[1])/X[1],N[L+j+j]=(Y[V+2]-Q[2])/X[2];return(0,kH.default)(N,[1,3,H,W])}async function q5(J,Q){if(typeof J==="string")J=zP(J,Q.publicPath),J=new URL(J);if(J instanceof URL)J=await(await fetch(J,{})).blob();if(J instanceof ArrayBuffer||ArrayBuffer.isView(J))J=new Blob([J]);if(J instanceof Blob)J=await DP(J);return J}function ZP(J){let Q=new Uint8Array(J.data.length);for(let X=0;X<J.data.length;X++)Q[X]=J.data[X]*255;return(0,kH.default)(Q,J.shape)}function DE(J,Q){let X=void 0;if(typeof OffscreenCanvas<"u")X=new OffscreenCanvas(J,Q);else X=document.createElement("canvas");if(!X)throw Error("Canvas nor OffscreenCanvas are available in the current context.");return X}var wP=A4(z4()),AE=async()=>{if(navigator.gpu===void 0)return!1;return await navigator.gpu.requestAdapter()!==null},kP=()=>navigator.hardwareConcurrency??4;async function jE(J,Q){return URL.createObjectURL(await zE(J,Q))}async function zE(J,Q){let X=new URL("resources.json",Q.publicPath),Y=await fetch(X);if(!Y.ok)throw Error("Resource metadata not found. Ensure that the config.publicPath is configured correctly.");let W=(await Y.json())[J];if(!W)throw Error(`Resource ${J} not found. Ensure that the config.publicPath is configured correctly.`);let G=W.chunks,j=0,N=G.map(async(B)=>{let U=B.offsets[1]-B.offsets[0],E=Q.publicPath?new URL(B.name,Q.publicPath).toString():B.name,A=await(await fetch(E,Q.fetchArgs)).blob();if(U!==A.size)throw Error(`Failed to fetch ${J} with size ${U} but got ${A.size}`);if(Q.progress)j+=U,Q.progress(`fetch:${J}`,j,W.size);return A}),V=await Promise.all(N),L=new Blob(V,{type:W.mime});if(L.size!==W.size)throw Error(`Failed to fetch ${J} with size ${W.size} but got ${L.size}`);return L}var Q5=null,$E=async(J)=>{if(Q5!==null)return Q5;if(J)Q5=(await Promise.resolve().then(() => (uV(),dV))).default;else Q5=(await Promise.resolve().then(() => (HE(),YE))).default;return Q5};async function CP(J,Q){let X=Q.device==="gpu"&&await AE(),Y=X&&Q.proxyToWorker,H=[X?"webgpu":"wasm"],W=await $E(X);if(Q.debug)console.debug("\tUsing WebGPU:",X),console.debug("\tProxy to Worker:",Y),W.env.debug=!0,W.env.logLevel="verbose";W.env.wasm.numThreads=kP(),W.env.wasm.proxy=Y;let G=X?"/onnxruntime-web/ort-wasm-simd-threaded.jsep":"/onnxruntime-web/ort-wasm-simd-threaded",j=await jE(`${G}.wasm`,Q),N=await jE(`${G}.mjs`,Q);if(W.env.wasm.wasmPaths={mjs:N,wasm:j},Q.debug)console.debug("ort.env.wasm:",W.env.wasm);let V={executionProviders:H,graphOptimizationLevel:"all",executionMode:"parallel",enableCpuMemArena:!0};return await W.InferenceSession.create(J,V).catch((B)=>{throw Error(`Failed to create session: "${B}". Please check if the publicPath is set correctly.`)})}async function IP(J,Q,X,Y){let H=Y.device==="gpu"&&await AE(),W=await $E(H),G={};for(let[V,L]of Q)G[V]=new W.Tensor("float32",new Float32Array(L.data),L.shape);let j=await J.run(G,{}),N=[];for(let V of X){let L=j[V],B=L.dims,U=L.data,E=(0,wP.default)(U,B);N.push(E)}return N}var l0;(function(J){J.assertEqual=(H)=>H;function Q(H){}J.assertIs=Q;function X(H){throw Error()}J.assertNever=X,J.arrayToEnum=(H)=>{let W={};for(let G of H)W[G]=G;return W},J.getValidEnumValues=(H)=>{let W=J.objectKeys(H).filter((j)=>typeof H[H[j]]!=="number"),G={};for(let j of W)G[j]=H[j];return J.objectValues(G)},J.objectValues=(H)=>{return J.objectKeys(H).map(function(W){return H[W]})},J.objectKeys=typeof Object.keys==="function"?(H)=>Object.keys(H):(H)=>{let W=[];for(let G in H)if(Object.prototype.hasOwnProperty.call(H,G))W.push(G);return W},J.find=(H,W)=>{for(let G of H)if(W(G))return G;return},J.isInteger=typeof Number.isInteger==="function"?(H)=>Number.isInteger(H):(H)=>typeof H==="number"&&isFinite(H)&&Math.floor(H)===H;function Y(H,W=" | "){return H.map((G)=>typeof G==="string"?`'${G}'`:G).join(W)}J.joinValues=Y,J.jsonStringifyReplacer=(H,W)=>{if(typeof W==="bigint")return W.toString();return W}})(l0||(l0={}));var AH;(function(J){J.mergeShapes=(Q,X)=>{return{...Q,...X}}})(AH||(AH={}));var K0=l0.arrayToEnum(["string","nan","number","integer","float","boolean","date","bigint","symbol","function","undefined","null","array","object","unknown","promise","void","never","map","set"]),g6=(J)=>{switch(typeof J){case"undefined":return K0.undefined;case"string":return K0.string;case"number":return isNaN(J)?K0.nan:K0.number;case"boolean":return K0.boolean;case"function":return K0.function;case"bigint":return K0.bigint;case"symbol":return K0.symbol;case"object":if(Array.isArray(J))return K0.array;if(J===null)return K0.null;if(J.then&&typeof J.then==="function"&&J.catch&&typeof J.catch==="function")return K0.promise;if(typeof Map<"u"&&J instanceof Map)return K0.map;if(typeof Set<"u"&&J instanceof Set)return K0.set;if(typeof Date<"u"&&J instanceof Date)return K0.date;return K0.object;default:return K0.unknown}},q0=l0.arrayToEnum(["invalid_type","invalid_literal","custom","invalid_union","invalid_union_discriminator","invalid_enum_value","unrecognized_keys","invalid_arguments","invalid_return_type","invalid_date","invalid_string","too_small","too_big","invalid_intersection_types","not_multiple_of","not_finite"]),_P=(J)=>{return JSON.stringify(J,null,2).replace(/"([^"]+)":/g,"$1:")},B6=class J extends Error{get errors(){return this.issues}constructor(Q){super();this.issues=[],this.addIssue=(Y)=>{this.issues=[...this.issues,Y]},this.addIssues=(Y=[])=>{this.issues=[...this.issues,...Y]};let X=new.target.prototype;if(Object.setPrototypeOf)Object.setPrototypeOf(this,X);else this.__proto__=X;this.name="ZodError",this.issues=Q}format(Q){let X=Q||function(W){return W.message},Y={_errors:[]},H=(W)=>{for(let G of W.issues)if(G.code==="invalid_union")G.unionErrors.map(H);else if(G.code==="invalid_return_type")H(G.returnTypeError);else if(G.code==="invalid_arguments")H(G.argumentsError);else if(G.path.length===0)Y._errors.push(X(G));else{let j=Y,N=0;while(N<G.path.length){let V=G.path[N];if(N!==G.path.length-1)j[V]=j[V]||{_errors:[]};else j[V]=j[V]||{_errors:[]},j[V]._errors.push(X(G));j=j[V],N++}}};return H(this),Y}static assert(Q){if(!(Q instanceof J))throw Error(`Not a ZodError: ${Q}`)}toString(){return this.message}get message(){return JSON.stringify(this.issues,l0.jsonStringifyReplacer,2)}get isEmpty(){return this.issues.length===0}flatten(Q=(X)=>X.message){let X={},Y=[];for(let H of this.issues)if(H.path.length>0)X[H.path[0]]=X[H.path[0]]||[],X[H.path[0]].push(Q(H));else Y.push(Q(H));return{formErrors:Y,fieldErrors:X}}get formErrors(){return this.flatten()}};B6.create=(J)=>{return new B6(J)};var F7=(J,Q)=>{let X;switch(J.code){case q0.invalid_type:if(J.received===K0.undefined)X="Required";else X=`Expected ${J.expected}, received ${J.received}`;break;case q0.invalid_literal:X=`Invalid literal value, expected ${JSON.stringify(J.expected,l0.jsonStringifyReplacer)}`;break;case q0.unrecognized_keys:X=`Unrecognized key(s) in object: ${l0.joinValues(J.keys,", ")}`;break;case q0.invalid_union:X="Invalid input";break;case q0.invalid_union_discriminator:X=`Invalid discriminator value. Expected ${l0.joinValues(J.options)}`;break;case q0.invalid_enum_value:X=`Invalid enum value. Expected ${l0.joinValues(J.options)}, received '${J.received}'`;break;case q0.invalid_arguments:X="Invalid function arguments";break;case q0.invalid_return_type:X="Invalid function return type";break;case q0.invalid_date:X="Invalid date";break;case q0.invalid_string:if(typeof J.validation==="object")if("includes"in J.validation){if(X=`Invalid input: must include "${J.validation.includes}"`,typeof J.validation.position==="number")X=`${X} at one or more positions greater than or equal to ${J.validation.position}`}else if("startsWith"in J.validation)X=`Invalid input: must start with "${J.validation.startsWith}"`;else if("endsWith"in J.validation)X=`Invalid input: must end with "${J.validation.endsWith}"`;else l0.assertNever(J.validation);else if(J.validation!=="regex")X=`Invalid ${J.validation}`;else X="Invalid";break;case q0.too_small:if(J.type==="array")X=`Array must contain ${J.exact?"exactly":J.inclusive?"at least":"more than"} ${J.minimum} element(s)`;else if(J.type==="string")X=`String must contain ${J.exact?"exactly":J.inclusive?"at least":"over"} ${J.minimum} character(s)`;else if(J.type==="number")X=`Number must be ${J.exact?"exactly equal to ":J.inclusive?"greater than or equal to ":"greater than "}${J.minimum}`;else if(J.type==="date")X=`Date must be ${J.exact?"exactly equal to ":J.inclusive?"greater than or equal to ":"greater than "}${new Date(Number(J.minimum))}`;else X="Invalid input";break;case q0.too_big:if(J.type==="array")X=`Array must contain ${J.exact?"exactly":J.inclusive?"at most":"less than"} ${J.maximum} element(s)`;else if(J.type==="string")X=`String must contain ${J.exact?"exactly":J.inclusive?"at most":"under"} ${J.maximum} character(s)`;else if(J.type==="number")X=`Number must be ${J.exact?"exactly":J.inclusive?"less than or equal to":"less than"} ${J.maximum}`;else if(J.type==="bigint")X=`BigInt must be ${J.exact?"exactly":J.inclusive?"less than or equal to":"less than"} ${J.maximum}`;else if(J.type==="date")X=`Date must be ${J.exact?"exactly":J.inclusive?"smaller than or equal to":"smaller than"} ${new Date(Number(J.maximum))}`;else X="Invalid input";break;case q0.custom:X="Invalid input";break;case q0.invalid_intersection_types:X="Intersection results could not be merged";break;case q0.not_multiple_of:X=`Number must be a multiple of ${J.multipleOf}`;break;case q0.not_finite:X="Number must be finite";break;default:X=Q.defaultError,l0.assertNever(J)}return{message:X}},PE=F7;function bP(J){PE=J}function M4(){return PE}var B4=(J)=>{let{data:Q,path:X,errorMaps:Y,issueData:H}=J,W=[...X,...H.path||[]],G={...H,path:W};if(H.message!==void 0)return{...H,path:W,message:H.message};let j="",N=Y.filter((V)=>!!V).slice().reverse();for(let V of N)j=V(G,{data:Q,defaultError:j}).message;return{...H,path:W,message:j}},vP=[];function V0(J,Q){let X=M4(),Y=B4({issueData:Q,data:J.data,path:J.path,errorMaps:[J.common.contextualErrorMap,J.schemaErrorMap,X,X===F7?void 0:F7].filter((H)=>!!H)});J.common.issues.push(Y)}var C1=class J{constructor(){this.value="valid"}dirty(){if(this.value==="valid")this.value="dirty"}abort(){if(this.value!=="aborted")this.value="aborted"}static mergeArray(Q,X){let Y=[];for(let H of X){if(H.status==="aborted")return S0;if(H.status==="dirty")Q.dirty();Y.push(H.value)}return{status:Q.value,value:Y}}static async mergeObjectAsync(Q,X){let Y=[];for(let H of X){let W=await H.key,G=await H.value;Y.push({key:W,value:G})}return J.mergeObjectSync(Q,Y)}static mergeObjectSync(Q,X){let Y={};for(let H of X){let{key:W,value:G}=H;if(W.status==="aborted")return S0;if(G.status==="aborted")return S0;if(W.status==="dirty")Q.dirty();if(G.status==="dirty")Q.dirty();if(W.value!=="__proto__"&&(typeof G.value<"u"||H.alwaysSet))Y[W.value]=G.value}return{status:Q.value,value:Y}}},S0=Object.freeze({status:"aborted"}),j7=(J)=>({status:"dirty",value:J}),k1=(J)=>({status:"valid",value:J}),zH=(J)=>J.status==="aborted",$H=(J)=>J.status==="dirty",a8=(J)=>J.status==="valid",W5=(J)=>typeof Promise<"u"&&J instanceof Promise;function L4(J,Q,X,Y){if(X==="a"&&!Y)throw TypeError("Private accessor was defined without a getter");if(typeof Q==="function"?J!==Q||!Y:!Q.has(J))throw TypeError("Cannot read private member from an object whose class did not declare it");return X==="m"?Y:X==="a"?Y.call(J):Y?Y.value:Q.get(J)}function SE(J,Q,X,Y,H){if(Y==="m")throw TypeError("Private method is not writable");if(Y==="a"&&!H)throw TypeError("Private accessor was defined without a setter");if(typeof Q==="function"?J!==Q||!H:!Q.has(J))throw TypeError("Cannot write private member to an object whose class did not declare it");return Y==="a"?H.call(J,X):H?H.value=X:Q.set(J,X),X}var E0;(function(J){J.errToObj=(Q)=>typeof Q==="string"?{message:Q}:Q||{},J.toString=(Q)=>typeof Q==="string"?Q:Q===null||Q===void 0?void 0:Q.message})(E0||(E0={}));var X5,Y5,E6=class{constructor(J,Q,X,Y){this._cachedPath=[],this.parent=J,this.data=Q,this._path=X,this._key=Y}get path(){if(!this._cachedPath.length)if(this._key instanceof Array)this._cachedPath.push(...this._path,...this._key);else this._cachedPath.push(...this._path,this._key);return this._cachedPath}},FE=(J,Q)=>{if(a8(Q))return{success:!0,data:Q.value};else{if(!J.common.issues.length)throw Error("Validation failed but no issues detected.");return{success:!1,get error(){if(this._error)return this._error;let X=new B6(J.common.issues);return this._error=X,this._error}}}};function v0(J){if(!J)return{};let{errorMap:Q,invalid_type_error:X,required_error:Y,description:H}=J;if(Q&&(X||Y))throw Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);if(Q)return{errorMap:Q,description:H};return{errorMap:(G,j)=>{var N,V;let{message:L}=J;if(G.code==="invalid_enum_value")return{message:L!==null&&L!==void 0?L:j.defaultError};if(typeof j.data>"u")return{message:(N=L!==null&&L!==void 0?L:Y)!==null&&N!==void 0?N:j.defaultError};if(G.code!=="invalid_type")return{message:j.defaultError};return{message:(V=L!==null&&L!==void 0?L:X)!==null&&V!==void 0?V:j.defaultError}},description:H}}var T0=class{get description(){return this._def.description}_getType(J){return g6(J.data)}_getOrReturnCtx(J,Q){return Q||{common:J.parent.common,data:J.data,parsedType:g6(J.data),schemaErrorMap:this._def.errorMap,path:J.path,parent:J.parent}}_processInputParams(J){return{status:new C1,ctx:{common:J.parent.common,data:J.data,parsedType:g6(J.data),schemaErrorMap:this._def.errorMap,path:J.path,parent:J.parent}}}_parseSync(J){let Q=this._parse(J);if(W5(Q))throw Error("Synchronous parse encountered promise.");return Q}_parseAsync(J){let Q=this._parse(J);return Promise.resolve(Q)}parse(J,Q){let X=this.safeParse(J,Q);if(X.success)return X.data;throw X.error}safeParse(J,Q){var X;let Y={common:{issues:[],async:(X=Q===null||Q===void 0?void 0:Q.async)!==null&&X!==void 0?X:!1,contextualErrorMap:Q===null||Q===void 0?void 0:Q.errorMap},path:(Q===null||Q===void 0?void 0:Q.path)||[],schemaErrorMap:this._def.errorMap,parent:null,data:J,parsedType:g6(J)},H=this._parseSync({data:J,path:Y.path,parent:Y});return FE(Y,H)}"~validate"(J){var Q,X;let Y={common:{issues:[],async:!!this["~standard"].async},path:[],schemaErrorMap:this._def.errorMap,parent:null,data:J,parsedType:g6(J)};if(!this["~standard"].async)try{let H=this._parseSync({data:J,path:[],parent:Y});return a8(H)?{value:H.value}:{issues:Y.common.issues}}catch(H){if((X=(Q=H===null||H===void 0?void 0:H.message)===null||Q===void 0?void 0:Q.toLowerCase())===null||X===void 0?void 0:X.includes("encountered"))this["~standard"].async=!0;Y.common={issues:[],async:!0}}return this._parseAsync({data:J,path:[],parent:Y}).then((H)=>a8(H)?{value:H.value}:{issues:Y.common.issues})}async parseAsync(J,Q){let X=await this.safeParseAsync(J,Q);if(X.success)return X.data;throw X.error}async safeParseAsync(J,Q){let X={common:{issues:[],contextualErrorMap:Q===null||Q===void 0?void 0:Q.errorMap,async:!0},path:(Q===null||Q===void 0?void 0:Q.path)||[],schemaErrorMap:this._def.errorMap,parent:null,data:J,parsedType:g6(J)},Y=this._parse({data:J,path:X.path,parent:X}),H=await(W5(Y)?Y:Promise.resolve(Y));return FE(X,H)}refine(J,Q){let X=(Y)=>{if(typeof Q==="string"||typeof Q>"u")return{message:Q};else if(typeof Q==="function")return Q(Y);else return Q};return this._refinement((Y,H)=>{let W=J(Y),G=()=>H.addIssue({code:q0.custom,...X(Y)});if(typeof Promise<"u"&&W instanceof Promise)return W.then((j)=>{if(!j)return G(),!1;else return!0});if(!W)return G(),!1;else return!0})}refinement(J,Q){return this._refinement((X,Y)=>{if(!J(X))return Y.addIssue(typeof Q==="function"?Q(X,Y):Q),!1;else return!0})}_refinement(J){return new L6({schema:this,typeName:P0.ZodEffects,effect:{type:"refinement",refinement:J}})}superRefine(J){return this._refinement(J)}constructor(J){this.spa=this.safeParseAsync,this._def=J,this.parse=this.parse.bind(this),this.safeParse=this.safeParse.bind(this),this.parseAsync=this.parseAsync.bind(this),this.safeParseAsync=this.safeParseAsync.bind(this),this.spa=this.spa.bind(this),this.refine=this.refine.bind(this),this.refinement=this.refinement.bind(this),this.superRefine=this.superRefine.bind(this),this.optional=this.optional.bind(this),this.nullable=this.nullable.bind(this),this.nullish=this.nullish.bind(this),this.array=this.array.bind(this),this.promise=this.promise.bind(this),this.or=this.or.bind(this),this.and=this.and.bind(this),this.transform=this.transform.bind(this),this.brand=this.brand.bind(this),this.default=this.default.bind(this),this.catch=this.catch.bind(this),this.describe=this.describe.bind(this),this.pipe=this.pipe.bind(this),this.readonly=this.readonly.bind(this),this.isNullable=this.isNullable.bind(this),this.isOptional=this.isOptional.bind(this),this["~standard"]={version:1,vendor:"zod",validate:(Q)=>this["~validate"](Q)}}optional(){return R6.create(this,this._def)}nullable(){return t6.create(this,this._def)}nullish(){return this.nullable().optional()}array(){return i8.create(this)}promise(){return K7.create(this,this._def)}or(J){return M5.create([this,J],this._def)}and(J){return B5.create(this,J,this._def)}transform(J){return new L6({...v0(this._def),schema:this,typeName:P0.ZodEffects,effect:{type:"transform",transform:J}})}default(J){let Q=typeof J==="function"?J:()=>J;return new R5({...v0(this._def),innerType:this,defaultValue:Q,typeName:P0.ZodDefault})}brand(){return new CH({typeName:P0.ZodBranded,type:this,...v0(this._def)})}catch(J){let Q=typeof J==="function"?J:()=>J;return new E5({...v0(this._def),innerType:this,catchValue:Q,typeName:P0.ZodCatch})}describe(J){return new this.constructor({...this._def,description:J})}pipe(J){return IH.create(this,J)}readonly(){return D5.create(this)}isOptional(){return this.safeParse(void 0).success}isNullable(){return this.safeParse(null).success}},TP=/^c[^\s-]{8,}$/i,xP=/^[0-9a-z]+$/,fP=/^[0-9A-HJKMNP-TV-Z]{26}$/i,hP=/^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i,yP=/^[a-z0-9_-]{21}$/i,gP=/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/,lP=/^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/,mP=/^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i,pP="^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$",EH,cP=/^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/,dP=/^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/,uP=/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/,oP=/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/,sP=/^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/,aP=/^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/,ZE="((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))",iP=new RegExp(`^${ZE}$`);function wE(J){let Q="([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d";if(J.precision)Q=`${Q}\\.\\d{${J.precision}}`;else if(J.precision==null)Q=`${Q}(\\.\\d+)?`;return Q}function nP(J){return new RegExp(`^${wE(J)}$`)}function kE(J){let Q=`${ZE}T${wE(J)}`,X=[];if(X.push(J.local?"Z?":"Z"),J.offset)X.push("([+-]\\d{2}:?\\d{2})");return Q=`${Q}(${X.join("|")})`,new RegExp(`^${Q}$`)}function rP(J,Q){if((Q==="v4"||!Q)&&cP.test(J))return!0;if((Q==="v6"||!Q)&&uP.test(J))return!0;return!1}function tP(J,Q){if(!gP.test(J))return!1;try{let[X]=J.split("."),Y=X.replace(/-/g,"+").replace(/_/g,"/").padEnd(X.length+(4-X.length%4)%4,"="),H=JSON.parse(atob(Y));if(typeof H!=="object"||H===null)return!1;if(!H.typ||!H.alg)return!1;if(Q&&H.alg!==Q)return!1;return!0}catch(X){return!1}}function eP(J,Q){if((Q==="v4"||!Q)&&dP.test(J))return!0;if((Q==="v6"||!Q)&&oP.test(J))return!0;return!1}var N7=class J extends T0{_parse(Q){if(this._def.coerce)Q.data=String(Q.data);if(this._getType(Q)!==K0.string){let W=this._getOrReturnCtx(Q);return V0(W,{code:q0.invalid_type,expected:K0.string,received:W.parsedType}),S0}let Y=new C1,H=void 0;for(let W of this._def.checks)if(W.kind==="min"){if(Q.data.length<W.value)H=this._getOrReturnCtx(Q,H),V0(H,{code:q0.too_small,minimum:W.value,type:"string",inclusive:!0,exact:!1,message:W.message}),Y.dirty()}else if(W.kind==="max"){if(Q.data.length>W.value)H=this._getOrReturnCtx(Q,H),V0(H,{code:q0.too_big,maximum:W.value,type:"string",inclusive:!0,exact:!1,message:W.message}),Y.dirty()}else if(W.kind==="length"){let G=Q.data.length>W.value,j=Q.data.length<W.value;if(G||j){if(H=this._getOrReturnCtx(Q,H),G)V0(H,{code:q0.too_big,maximum:W.value,type:"string",inclusive:!0,exact:!0,message:W.message});else if(j)V0(H,{code:q0.too_small,minimum:W.value,type:"string",inclusive:!0,exact:!0,message:W.message});Y.dirty()}}else if(W.kind==="email"){if(!mP.test(Q.data))H=this._getOrReturnCtx(Q,H),V0(H,{validation:"email",code:q0.invalid_string,message:W.message}),Y.dirty()}else if(W.kind==="emoji"){if(!EH)EH=new RegExp(pP,"u");if(!EH.test(Q.data))H=this._getOrReturnCtx(Q,H),V0(H,{validation:"emoji",code:q0.invalid_string,message:W.message}),Y.dirty()}else if(W.kind==="uuid"){if(!hP.test(Q.data))H=this._getOrReturnCtx(Q,H),V0(H,{validation:"uuid",code:q0.invalid_string,message:W.message}),Y.dirty()}else if(W.kind==="nanoid"){if(!yP.test(Q.data))H=this._getOrReturnCtx(Q,H),V0(H,{validation:"nanoid",code:q0.invalid_string,message:W.message}),Y.dirty()}else if(W.kind==="cuid"){if(!TP.test(Q.data))H=this._getOrReturnCtx(Q,H),V0(H,{validation:"cuid",code:q0.invalid_string,message:W.message}),Y.dirty()}else if(W.kind==="cuid2"){if(!xP.test(Q.data))H=this._getOrReturnCtx(Q,H),V0(H,{validation:"cuid2",code:q0.invalid_string,message:W.message}),Y.dirty()}else if(W.kind==="ulid"){if(!fP.test(Q.data))H=this._getOrReturnCtx(Q,H),V0(H,{validation:"ulid",code:q0.invalid_string,message:W.message}),Y.dirty()}else if(W.kind==="url")try{new URL(Q.data)}catch(G){H=this._getOrReturnCtx(Q,H),V0(H,{validation:"url",code:q0.invalid_string,message:W.message}),Y.dirty()}else if(W.kind==="regex"){if(W.regex.lastIndex=0,!W.regex.test(Q.data))H=this._getOrReturnCtx(Q,H),V0(H,{validation:"regex",code:q0.invalid_string,message:W.message}),Y.dirty()}else if(W.kind==="trim")Q.data=Q.data.trim();else if(W.kind==="includes"){if(!Q.data.includes(W.value,W.position))H=this._getOrReturnCtx(Q,H),V0(H,{code:q0.invalid_string,validation:{includes:W.value,position:W.position},message:W.message}),Y.dirty()}else if(W.kind==="toLowerCase")Q.data=Q.data.toLowerCase();else if(W.kind==="toUpperCase")Q.data=Q.data.toUpperCase();else if(W.kind==="startsWith"){if(!Q.data.startsWith(W.value))H=this._getOrReturnCtx(Q,H),V0(H,{code:q0.invalid_string,validation:{startsWith:W.value},message:W.message}),Y.dirty()}else if(W.kind==="endsWith"){if(!Q.data.endsWith(W.value))H=this._getOrReturnCtx(Q,H),V0(H,{code:q0.invalid_string,validation:{endsWith:W.value},message:W.message}),Y.dirty()}else if(W.kind==="datetime"){if(!kE(W).test(Q.data))H=this._getOrReturnCtx(Q,H),V0(H,{code:q0.invalid_string,validation:"datetime",message:W.message}),Y.dirty()}else if(W.kind==="date"){if(!iP.test(Q.data))H=this._getOrReturnCtx(Q,H),V0(H,{code:q0.invalid_string,validation:"date",message:W.message}),Y.dirty()}else if(W.kind==="time"){if(!nP(W).test(Q.data))H=this._getOrReturnCtx(Q,H),V0(H,{code:q0.invalid_string,validation:"time",message:W.message}),Y.dirty()}else if(W.kind==="duration"){if(!lP.test(Q.data))H=this._getOrReturnCtx(Q,H),V0(H,{validation:"duration",code:q0.invalid_string,message:W.message}),Y.dirty()}else if(W.kind==="ip"){if(!rP(Q.data,W.version))H=this._getOrReturnCtx(Q,H),V0(H,{validation:"ip",code:q0.invalid_string,message:W.message}),Y.dirty()}else if(W.kind==="jwt"){if(!tP(Q.data,W.alg))H=this._getOrReturnCtx(Q,H),V0(H,{validation:"jwt",code:q0.invalid_string,message:W.message}),Y.dirty()}else if(W.kind==="cidr"){if(!eP(Q.data,W.version))H=this._getOrReturnCtx(Q,H),V0(H,{validation:"cidr",code:q0.invalid_string,message:W.message}),Y.dirty()}else if(W.kind==="base64"){if(!sP.test(Q.data))H=this._getOrReturnCtx(Q,H),V0(H,{validation:"base64",code:q0.invalid_string,message:W.message}),Y.dirty()}else if(W.kind==="base64url"){if(!aP.test(Q.data))H=this._getOrReturnCtx(Q,H),V0(H,{validation:"base64url",code:q0.invalid_string,message:W.message}),Y.dirty()}else l0.assertNever(W);return{status:Y.value,value:Q.data}}_regex(Q,X,Y){return this.refinement((H)=>Q.test(H),{validation:X,code:q0.invalid_string,...E0.errToObj(Y)})}_addCheck(Q){return new J({...this._def,checks:[...this._def.checks,Q]})}email(Q){return this._addCheck({kind:"email",...E0.errToObj(Q)})}url(Q){return this._addCheck({kind:"url",...E0.errToObj(Q)})}emoji(Q){return this._addCheck({kind:"emoji",...E0.errToObj(Q)})}uuid(Q){return this._addCheck({kind:"uuid",...E0.errToObj(Q)})}nanoid(Q){return this._addCheck({kind:"nanoid",...E0.errToObj(Q)})}cuid(Q){return this._addCheck({kind:"cuid",...E0.errToObj(Q)})}cuid2(Q){return this._addCheck({kind:"cuid2",...E0.errToObj(Q)})}ulid(Q){return this._addCheck({kind:"ulid",...E0.errToObj(Q)})}base64(Q){return this._addCheck({kind:"base64",...E0.errToObj(Q)})}base64url(Q){return this._addCheck({kind:"base64url",...E0.errToObj(Q)})}jwt(Q){return this._addCheck({kind:"jwt",...E0.errToObj(Q)})}ip(Q){return this._addCheck({kind:"ip",...E0.errToObj(Q)})}cidr(Q){return this._addCheck({kind:"cidr",...E0.errToObj(Q)})}datetime(Q){var X,Y;if(typeof Q==="string")return this._addCheck({kind:"datetime",precision:null,offset:!1,local:!1,message:Q});return this._addCheck({kind:"datetime",precision:typeof(Q===null||Q===void 0?void 0:Q.precision)>"u"?null:Q===null||Q===void 0?void 0:Q.precision,offset:(X=Q===null||Q===void 0?void 0:Q.offset)!==null&&X!==void 0?X:!1,local:(Y=Q===null||Q===void 0?void 0:Q.local)!==null&&Y!==void 0?Y:!1,...E0.errToObj(Q===null||Q===void 0?void 0:Q.message)})}date(Q){return this._addCheck({kind:"date",message:Q})}time(Q){if(typeof Q==="string")return this._addCheck({kind:"time",precision:null,message:Q});return this._addCheck({kind:"time",precision:typeof(Q===null||Q===void 0?void 0:Q.precision)>"u"?null:Q===null||Q===void 0?void 0:Q.precision,...E0.errToObj(Q===null||Q===void 0?void 0:Q.message)})}duration(Q){return this._addCheck({kind:"duration",...E0.errToObj(Q)})}regex(Q,X){return this._addCheck({kind:"regex",regex:Q,...E0.errToObj(X)})}includes(Q,X){return this._addCheck({kind:"includes",value:Q,position:X===null||X===void 0?void 0:X.position,...E0.errToObj(X===null||X===void 0?void 0:X.message)})}startsWith(Q,X){return this._addCheck({kind:"startsWith",value:Q,...E0.errToObj(X)})}endsWith(Q,X){return this._addCheck({kind:"endsWith",value:Q,...E0.errToObj(X)})}min(Q,X){return this._addCheck({kind:"min",value:Q,...E0.errToObj(X)})}max(Q,X){return this._addCheck({kind:"max",value:Q,...E0.errToObj(X)})}length(Q,X){return this._addCheck({kind:"length",value:Q,...E0.errToObj(X)})}nonempty(Q){return this.min(1,E0.errToObj(Q))}trim(){return new J({...this._def,checks:[...this._def.checks,{kind:"trim"}]})}toLowerCase(){return new J({...this._def,checks:[...this._def.checks,{kind:"toLowerCase"}]})}toUpperCase(){return new J({...this._def,checks:[...this._def.checks,{kind:"toUpperCase"}]})}get isDatetime(){return!!this._def.checks.find((Q)=>Q.kind==="datetime")}get isDate(){return!!this._def.checks.find((Q)=>Q.kind==="date")}get isTime(){return!!this._def.checks.find((Q)=>Q.kind==="time")}get isDuration(){return!!this._def.checks.find((Q)=>Q.kind==="duration")}get isEmail(){return!!this._def.checks.find((Q)=>Q.kind==="email")}get isURL(){return!!this._def.checks.find((Q)=>Q.kind==="url")}get isEmoji(){return!!this._def.checks.find((Q)=>Q.kind==="emoji")}get isUUID(){return!!this._def.checks.find((Q)=>Q.kind==="uuid")}get isNANOID(){return!!this._def.checks.find((Q)=>Q.kind==="nanoid")}get isCUID(){return!!this._def.checks.find((Q)=>Q.kind==="cuid")}get isCUID2(){return!!this._def.checks.find((Q)=>Q.kind==="cuid2")}get isULID(){return!!this._def.checks.find((Q)=>Q.kind==="ulid")}get isIP(){return!!this._def.checks.find((Q)=>Q.kind==="ip")}get isCIDR(){return!!this._def.checks.find((Q)=>Q.kind==="cidr")}get isBase64(){return!!this._def.checks.find((Q)=>Q.kind==="base64")}get isBase64url(){return!!this._def.checks.find((Q)=>Q.kind==="base64url")}get minLength(){let Q=null;for(let X of this._def.checks)if(X.kind==="min"){if(Q===null||X.value>Q)Q=X.value}return Q}get maxLength(){let Q=null;for(let X of this._def.checks)if(X.kind==="max"){if(Q===null||X.value<Q)Q=X.value}return Q}};N7.create=(J)=>{var Q;return new N7({checks:[],typeName:P0.ZodString,coerce:(Q=J===null||J===void 0?void 0:J.coerce)!==null&&Q!==void 0?Q:!1,...v0(J)})};function JS(J,Q){let X=(J.toString().split(".")[1]||"").length,Y=(Q.toString().split(".")[1]||"").length,H=X>Y?X:Y,W=parseInt(J.toFixed(H).replace(".","")),G=parseInt(Q.toFixed(H).replace(".",""));return W%G/Math.pow(10,H)}var G5=class J extends T0{constructor(){super(...arguments);this.min=this.gte,this.max=this.lte,this.step=this.multipleOf}_parse(Q){if(this._def.coerce)Q.data=Number(Q.data);if(this._getType(Q)!==K0.number){let W=this._getOrReturnCtx(Q);return V0(W,{code:q0.invalid_type,expected:K0.number,received:W.parsedType}),S0}let Y=void 0,H=new C1;for(let W of this._def.checks)if(W.kind==="int"){if(!l0.isInteger(Q.data))Y=this._getOrReturnCtx(Q,Y),V0(Y,{code:q0.invalid_type,expected:"integer",received:"float",message:W.message}),H.dirty()}else if(W.kind==="min"){if(W.inclusive?Q.data<W.value:Q.data<=W.value)Y=this._getOrReturnCtx(Q,Y),V0(Y,{code:q0.too_small,minimum:W.value,type:"number",inclusive:W.inclusive,exact:!1,message:W.message}),H.dirty()}else if(W.kind==="max"){if(W.inclusive?Q.data>W.value:Q.data>=W.value)Y=this._getOrReturnCtx(Q,Y),V0(Y,{code:q0.too_big,maximum:W.value,type:"number",inclusive:W.inclusive,exact:!1,message:W.message}),H.dirty()}else if(W.kind==="multipleOf"){if(JS(Q.data,W.value)!==0)Y=this._getOrReturnCtx(Q,Y),V0(Y,{code:q0.not_multiple_of,multipleOf:W.value,message:W.message}),H.dirty()}else if(W.kind==="finite"){if(!Number.isFinite(Q.data))Y=this._getOrReturnCtx(Q,Y),V0(Y,{code:q0.not_finite,message:W.message}),H.dirty()}else l0.assertNever(W);return{status:H.value,value:Q.data}}gte(Q,X){return this.setLimit("min",Q,!0,E0.toString(X))}gt(Q,X){return this.setLimit("min",Q,!1,E0.toString(X))}lte(Q,X){return this.setLimit("max",Q,!0,E0.toString(X))}lt(Q,X){return this.setLimit("max",Q,!1,E0.toString(X))}setLimit(Q,X,Y,H){return new J({...this._def,checks:[...this._def.checks,{kind:Q,value:X,inclusive:Y,message:E0.toString(H)}]})}_addCheck(Q){return new J({...this._def,checks:[...this._def.checks,Q]})}int(Q){return this._addCheck({kind:"int",message:E0.toString(Q)})}positive(Q){return this._addCheck({kind:"min",value:0,inclusive:!1,message:E0.toString(Q)})}negative(Q){return this._addCheck({kind:"max",value:0,inclusive:!1,message:E0.toString(Q)})}nonpositive(Q){return this._addCheck({kind:"max",value:0,inclusive:!0,message:E0.toString(Q)})}nonnegative(Q){return this._addCheck({kind:"min",value:0,inclusive:!0,message:E0.toString(Q)})}multipleOf(Q,X){return this._addCheck({kind:"multipleOf",value:Q,message:E0.toString(X)})}finite(Q){return this._addCheck({kind:"finite",message:E0.toString(Q)})}safe(Q){return this._addCheck({kind:"min",inclusive:!0,value:Number.MIN_SAFE_INTEGER,message:E0.toString(Q)})._addCheck({kind:"max",inclusive:!0,value:Number.MAX_SAFE_INTEGER,message:E0.toString(Q)})}get minValue(){let Q=null;for(let X of this._def.checks)if(X.kind==="min"){if(Q===null||X.value>Q)Q=X.value}return Q}get maxValue(){let Q=null;for(let X of this._def.checks)if(X.kind==="max"){if(Q===null||X.value<Q)Q=X.value}return Q}get isInt(){return!!this._def.checks.find((Q)=>Q.kind==="int"||Q.kind==="multipleOf"&&l0.isInteger(Q.value))}get isFinite(){let Q=null,X=null;for(let Y of this._def.checks)if(Y.kind==="finite"||Y.kind==="int"||Y.kind==="multipleOf")return!0;else if(Y.kind==="min"){if(X===null||Y.value>X)X=Y.value}else if(Y.kind==="max"){if(Q===null||Y.value<Q)Q=Y.value}return Number.isFinite(X)&&Number.isFinite(Q)}};G5.create=(J)=>{return new G5({checks:[],typeName:P0.ZodNumber,coerce:(J===null||J===void 0?void 0:J.coerce)||!1,...v0(J)})};var j5=class J extends T0{constructor(){super(...arguments);this.min=this.gte,this.max=this.lte}_parse(Q){if(this._def.coerce)try{Q.data=BigInt(Q.data)}catch(W){return this._getInvalidInput(Q)}if(this._getType(Q)!==K0.bigint)return this._getInvalidInput(Q);let Y=void 0,H=new C1;for(let W of this._def.checks)if(W.kind==="min"){if(W.inclusive?Q.data<W.value:Q.data<=W.value)Y=this._getOrReturnCtx(Q,Y),V0(Y,{code:q0.too_small,type:"bigint",minimum:W.value,inclusive:W.inclusive,message:W.message}),H.dirty()}else if(W.kind==="max"){if(W.inclusive?Q.data>W.value:Q.data>=W.value)Y=this._getOrReturnCtx(Q,Y),V0(Y,{code:q0.too_big,type:"bigint",maximum:W.value,inclusive:W.inclusive,message:W.message}),H.dirty()}else if(W.kind==="multipleOf"){if(Q.data%W.value!==BigInt(0))Y=this._getOrReturnCtx(Q,Y),V0(Y,{code:q0.not_multiple_of,multipleOf:W.value,message:W.message}),H.dirty()}else l0.assertNever(W);return{status:H.value,value:Q.data}}_getInvalidInput(Q){let X=this._getOrReturnCtx(Q);return V0(X,{code:q0.invalid_type,expected:K0.bigint,received:X.parsedType}),S0}gte(Q,X){return this.setLimit("min",Q,!0,E0.toString(X))}gt(Q,X){return this.setLimit("min",Q,!1,E0.toString(X))}lte(Q,X){return this.setLimit("max",Q,!0,E0.toString(X))}lt(Q,X){return this.setLimit("max",Q,!1,E0.toString(X))}setLimit(Q,X,Y,H){return new J({...this._def,checks:[...this._def.checks,{kind:Q,value:X,inclusive:Y,message:E0.toString(H)}]})}_addCheck(Q){return new J({...this._def,checks:[...this._def.checks,Q]})}positive(Q){return this._addCheck({kind:"min",value:BigInt(0),inclusive:!1,message:E0.toString(Q)})}negative(Q){return this._addCheck({kind:"max",value:BigInt(0),inclusive:!1,message:E0.toString(Q)})}nonpositive(Q){return this._addCheck({kind:"max",value:BigInt(0),inclusive:!0,message:E0.toString(Q)})}nonnegative(Q){return this._addCheck({kind:"min",value:BigInt(0),inclusive:!0,message:E0.toString(Q)})}multipleOf(Q,X){return this._addCheck({kind:"multipleOf",value:Q,message:E0.toString(X)})}get minValue(){let Q=null;for(let X of this._def.checks)if(X.kind==="min"){if(Q===null||X.value>Q)Q=X.value}return Q}get maxValue(){let Q=null;for(let X of this._def.checks)if(X.kind==="max"){if(Q===null||X.value<Q)Q=X.value}return Q}};j5.create=(J)=>{var Q;return new j5({checks:[],typeName:P0.ZodBigInt,coerce:(Q=J===null||J===void 0?void 0:J.coerce)!==null&&Q!==void 0?Q:!1,...v0(J)})};var F5=class extends T0{_parse(J){if(this._def.coerce)J.data=Boolean(J.data);if(this._getType(J)!==K0.boolean){let X=this._getOrReturnCtx(J);return V0(X,{code:q0.invalid_type,expected:K0.boolean,received:X.parsedType}),S0}return k1(J.data)}};F5.create=(J)=>{return new F5({typeName:P0.ZodBoolean,coerce:(J===null||J===void 0?void 0:J.coerce)||!1,...v0(J)})};var N5=class J extends T0{_parse(Q){if(this._def.coerce)Q.data=new Date(Q.data);if(this._getType(Q)!==K0.date){let W=this._getOrReturnCtx(Q);return V0(W,{code:q0.invalid_type,expected:K0.date,received:W.parsedType}),S0}if(isNaN(Q.data.getTime())){let W=this._getOrReturnCtx(Q);return V0(W,{code:q0.invalid_date}),S0}let Y=new C1,H=void 0;for(let W of this._def.checks)if(W.kind==="min"){if(Q.data.getTime()<W.value)H=this._getOrReturnCtx(Q,H),V0(H,{code:q0.too_small,message:W.message,inclusive:!0,exact:!1,minimum:W.value,type:"date"}),Y.dirty()}else if(W.kind==="max"){if(Q.data.getTime()>W.value)H=this._getOrReturnCtx(Q,H),V0(H,{code:q0.too_big,message:W.message,inclusive:!0,exact:!1,maximum:W.value,type:"date"}),Y.dirty()}else l0.assertNever(W);return{status:Y.value,value:new Date(Q.data.getTime())}}_addCheck(Q){return new J({...this._def,checks:[...this._def.checks,Q]})}min(Q,X){return this._addCheck({kind:"min",value:Q.getTime(),message:E0.toString(X)})}max(Q,X){return this._addCheck({kind:"max",value:Q.getTime(),message:E0.toString(X)})}get minDate(){let Q=null;for(let X of this._def.checks)if(X.kind==="min"){if(Q===null||X.value>Q)Q=X.value}return Q!=null?new Date(Q):null}get maxDate(){let Q=null;for(let X of this._def.checks)if(X.kind==="max"){if(Q===null||X.value<Q)Q=X.value}return Q!=null?new Date(Q):null}};N5.create=(J)=>{return new N5({checks:[],coerce:(J===null||J===void 0?void 0:J.coerce)||!1,typeName:P0.ZodDate,...v0(J)})};var U4=class extends T0{_parse(J){if(this._getType(J)!==K0.symbol){let X=this._getOrReturnCtx(J);return V0(X,{code:q0.invalid_type,expected:K0.symbol,received:X.parsedType}),S0}return k1(J.data)}};U4.create=(J)=>{return new U4({typeName:P0.ZodSymbol,...v0(J)})};var V5=class extends T0{_parse(J){if(this._getType(J)!==K0.undefined){let X=this._getOrReturnCtx(J);return V0(X,{code:q0.invalid_type,expected:K0.undefined,received:X.parsedType}),S0}return k1(J.data)}};V5.create=(J)=>{return new V5({typeName:P0.ZodUndefined,...v0(J)})};var K5=class extends T0{_parse(J){if(this._getType(J)!==K0.null){let X=this._getOrReturnCtx(J);return V0(X,{code:q0.invalid_type,expected:K0.null,received:X.parsedType}),S0}return k1(J.data)}};K5.create=(J)=>{return new K5({typeName:P0.ZodNull,...v0(J)})};var V7=class extends T0{constructor(){super(...arguments);this._any=!0}_parse(J){return k1(J.data)}};V7.create=(J)=>{return new V7({typeName:P0.ZodAny,...v0(J)})};var s8=class extends T0{constructor(){super(...arguments);this._unknown=!0}_parse(J){return k1(J.data)}};s8.create=(J)=>{return new s8({typeName:P0.ZodUnknown,...v0(J)})};var l6=class extends T0{_parse(J){let Q=this._getOrReturnCtx(J);return V0(Q,{code:q0.invalid_type,expected:K0.never,received:Q.parsedType}),S0}};l6.create=(J)=>{return new l6({typeName:P0.ZodNever,...v0(J)})};var O4=class extends T0{_parse(J){if(this._getType(J)!==K0.undefined){let X=this._getOrReturnCtx(J);return V0(X,{code:q0.invalid_type,expected:K0.void,received:X.parsedType}),S0}return k1(J.data)}};O4.create=(J)=>{return new O4({typeName:P0.ZodVoid,...v0(J)})};var i8=class J extends T0{_parse(Q){let{ctx:X,status:Y}=this._processInputParams(Q),H=this._def;if(X.parsedType!==K0.array)return V0(X,{code:q0.invalid_type,expected:K0.array,received:X.parsedType}),S0;if(H.exactLength!==null){let G=X.data.length>H.exactLength.value,j=X.data.length<H.exactLength.value;if(G||j)V0(X,{code:G?q0.too_big:q0.too_small,minimum:j?H.exactLength.value:void 0,maximum:G?H.exactLength.value:void 0,type:"array",inclusive:!0,exact:!0,message:H.exactLength.message}),Y.dirty()}if(H.minLength!==null){if(X.data.length<H.minLength.value)V0(X,{code:q0.too_small,minimum:H.minLength.value,type:"array",inclusive:!0,exact:!1,message:H.minLength.message}),Y.dirty()}if(H.maxLength!==null){if(X.data.length>H.maxLength.value)V0(X,{code:q0.too_big,maximum:H.maxLength.value,type:"array",inclusive:!0,exact:!1,message:H.maxLength.message}),Y.dirty()}if(X.common.async)return Promise.all([...X.data].map((G,j)=>{return H.type._parseAsync(new E6(X,G,X.path,j))})).then((G)=>{return C1.mergeArray(Y,G)});let W=[...X.data].map((G,j)=>{return H.type._parseSync(new E6(X,G,X.path,j))});return C1.mergeArray(Y,W)}get element(){return this._def.type}min(Q,X){return new J({...this._def,minLength:{value:Q,message:E0.toString(X)}})}max(Q,X){return new J({...this._def,maxLength:{value:Q,message:E0.toString(X)}})}length(Q,X){return new J({...this._def,exactLength:{value:Q,message:E0.toString(X)}})}nonempty(Q){return this.min(1,Q)}};i8.create=(J,Q)=>{return new i8({type:J,minLength:null,maxLength:null,exactLength:null,typeName:P0.ZodArray,...v0(Q)})};function G7(J){if(J instanceof u1){let Q={};for(let X in J.shape){let Y=J.shape[X];Q[X]=R6.create(G7(Y))}return new u1({...J._def,shape:()=>Q})}else if(J instanceof i8)return new i8({...J._def,type:G7(J.element)});else if(J instanceof R6)return R6.create(G7(J.unwrap()));else if(J instanceof t6)return t6.create(G7(J.unwrap()));else if(J instanceof r6)return r6.create(J.items.map((Q)=>G7(Q)));else return J}var u1=class J extends T0{constructor(){super(...arguments);this._cached=null,this.nonstrict=this.passthrough,this.augment=this.extend}_getCached(){if(this._cached!==null)return this._cached;let Q=this._def.shape(),X=l0.objectKeys(Q);return this._cached={shape:Q,keys:X}}_parse(Q){if(this._getType(Q)!==K0.object){let V=this._getOrReturnCtx(Q);return V0(V,{code:q0.invalid_type,expected:K0.object,received:V.parsedType}),S0}let{status:Y,ctx:H}=this._processInputParams(Q),{shape:W,keys:G}=this._getCached(),j=[];if(!(this._def.catchall instanceof l6&&this._def.unknownKeys==="strip")){for(let V in H.data)if(!G.includes(V))j.push(V)}let N=[];for(let V of G){let L=W[V],B=H.data[V];N.push({key:{status:"valid",value:V},value:L._parse(new E6(H,B,H.path,V)),alwaysSet:V in H.data})}if(this._def.catchall instanceof l6){let V=this._def.unknownKeys;if(V==="passthrough")for(let L of j)N.push({key:{status:"valid",value:L},value:{status:"valid",value:H.data[L]}});else if(V==="strict"){if(j.length>0)V0(H,{code:q0.unrecognized_keys,keys:j}),Y.dirty()}else if(V==="strip");else throw Error("Internal ZodObject error: invalid unknownKeys value.")}else{let V=this._def.catchall;for(let L of j){let B=H.data[L];N.push({key:{status:"valid",value:L},value:V._parse(new E6(H,B,H.path,L)),alwaysSet:L in H.data})}}if(H.common.async)return Promise.resolve().then(async()=>{let V=[];for(let L of N){let B=await L.key,U=await L.value;V.push({key:B,value:U,alwaysSet:L.alwaysSet})}return V}).then((V)=>{return C1.mergeObjectSync(Y,V)});else return C1.mergeObjectSync(Y,N)}get shape(){return this._def.shape()}strict(Q){return E0.errToObj,new J({...this._def,unknownKeys:"strict",...Q!==void 0?{errorMap:(X,Y)=>{var H,W,G,j;let N=(G=(W=(H=this._def).errorMap)===null||W===void 0?void 0:W.call(H,X,Y).message)!==null&&G!==void 0?G:Y.defaultError;if(X.code==="unrecognized_keys")return{message:(j=E0.errToObj(Q).message)!==null&&j!==void 0?j:N};return{message:N}}}:{}})}strip(){return new J({...this._def,unknownKeys:"strip"})}passthrough(){return new J({...this._def,unknownKeys:"passthrough"})}extend(Q){return new J({...this._def,shape:()=>({...this._def.shape(),...Q})})}merge(Q){return new J({unknownKeys:Q._def.unknownKeys,catchall:Q._def.catchall,shape:()=>({...this._def.shape(),...Q._def.shape()}),typeName:P0.ZodObject})}setKey(Q,X){return this.augment({[Q]:X})}catchall(Q){return new J({...this._def,catchall:Q})}pick(Q){let X={};return l0.objectKeys(Q).forEach((Y)=>{if(Q[Y]&&this.shape[Y])X[Y]=this.shape[Y]}),new J({...this._def,shape:()=>X})}omit(Q){let X={};return l0.objectKeys(this.shape).forEach((Y)=>{if(!Q[Y])X[Y]=this.shape[Y]}),new J({...this._def,shape:()=>X})}deepPartial(){return G7(this)}partial(Q){let X={};return l0.objectKeys(this.shape).forEach((Y)=>{let H=this.shape[Y];if(Q&&!Q[Y])X[Y]=H;else X[Y]=H.optional()}),new J({...this._def,shape:()=>X})}required(Q){let X={};return l0.objectKeys(this.shape).forEach((Y)=>{if(Q&&!Q[Y])X[Y]=this.shape[Y];else{let W=this.shape[Y];while(W instanceof R6)W=W._def.innerType;X[Y]=W}}),new J({...this._def,shape:()=>X})}keyof(){return bE(l0.objectKeys(this.shape))}};u1.create=(J,Q)=>{return new u1({shape:()=>J,unknownKeys:"strip",catchall:l6.create(),typeName:P0.ZodObject,...v0(Q)})};u1.strictCreate=(J,Q)=>{return new u1({shape:()=>J,unknownKeys:"strict",catchall:l6.create(),typeName:P0.ZodObject,...v0(Q)})};u1.lazycreate=(J,Q)=>{return new u1({shape:J,unknownKeys:"strip",catchall:l6.create(),typeName:P0.ZodObject,...v0(Q)})};var M5=class extends T0{_parse(J){let{ctx:Q}=this._processInputParams(J),X=this._def.options;function Y(H){for(let G of H)if(G.result.status==="valid")return G.result;for(let G of H)if(G.result.status==="dirty")return Q.common.issues.push(...G.ctx.common.issues),G.result;let W=H.map((G)=>new B6(G.ctx.common.issues));return V0(Q,{code:q0.invalid_union,unionErrors:W}),S0}if(Q.common.async)return Promise.all(X.map(async(H)=>{let W={...Q,common:{...Q.common,issues:[]},parent:null};return{result:await H._parseAsync({data:Q.data,path:Q.path,parent:W}),ctx:W}})).then(Y);else{let H=void 0,W=[];for(let j of X){let N={...Q,common:{...Q.common,issues:[]},parent:null},V=j._parseSync({data:Q.data,path:Q.path,parent:N});if(V.status==="valid")return V;else if(V.status==="dirty"&&!H)H={result:V,ctx:N};if(N.common.issues.length)W.push(N.common.issues)}if(H)return Q.common.issues.push(...H.ctx.common.issues),H.result;let G=W.map((j)=>new B6(j));return V0(Q,{code:q0.invalid_union,unionErrors:G}),S0}}get options(){return this._def.options}};M5.create=(J,Q)=>{return new M5({options:J,typeName:P0.ZodUnion,...v0(Q)})};var y6=(J)=>{if(J instanceof L5)return y6(J.schema);else if(J instanceof L6)return y6(J.innerType());else if(J instanceof U5)return[J.value];else if(J instanceof A5)return J.options;else if(J instanceof O5)return l0.objectValues(J.enum);else if(J instanceof R5)return y6(J._def.innerType);else if(J instanceof V5)return[void 0];else if(J instanceof K5)return[null];else if(J instanceof R6)return[void 0,...y6(J.unwrap())];else if(J instanceof t6)return[null,...y6(J.unwrap())];else if(J instanceof CH)return y6(J.unwrap());else if(J instanceof D5)return y6(J.unwrap());else if(J instanceof E5)return y6(J._def.innerType);else return[]},CE=class J extends T0{_parse(Q){let{ctx:X}=this._processInputParams(Q);if(X.parsedType!==K0.object)return V0(X,{code:q0.invalid_type,expected:K0.object,received:X.parsedType}),S0;let Y=this.discriminator,H=X.data[Y],W=this.optionsMap.get(H);if(!W)return V0(X,{code:q0.invalid_union_discriminator,options:Array.from(this.optionsMap.keys()),path:[Y]}),S0;if(X.common.async)return W._parseAsync({data:X.data,path:X.path,parent:X});else return W._parseSync({data:X.data,path:X.path,parent:X})}get discriminator(){return this._def.discriminator}get options(){return this._def.options}get optionsMap(){return this._def.optionsMap}static create(Q,X,Y){let H=new Map;for(let W of X){let G=y6(W.shape[Q]);if(!G.length)throw Error(`A discriminator value for key \`${Q}\` could not be extracted from all schema options`);for(let j of G){if(H.has(j))throw Error(`Discriminator property ${String(Q)} has duplicate value ${String(j)}`);H.set(j,W)}}return new J({typeName:P0.ZodDiscriminatedUnion,discriminator:Q,options:X,optionsMap:H,...v0(Y)})}};function PH(J,Q){let X=g6(J),Y=g6(Q);if(J===Q)return{valid:!0,data:J};else if(X===K0.object&&Y===K0.object){let H=l0.objectKeys(Q),W=l0.objectKeys(J).filter((j)=>H.indexOf(j)!==-1),G={...J,...Q};for(let j of W){let N=PH(J[j],Q[j]);if(!N.valid)return{valid:!1};G[j]=N.data}return{valid:!0,data:G}}else if(X===K0.array&&Y===K0.array){if(J.length!==Q.length)return{valid:!1};let H=[];for(let W=0;W<J.length;W++){let G=J[W],j=Q[W],N=PH(G,j);if(!N.valid)return{valid:!1};H.push(N.data)}return{valid:!0,data:H}}else if(X===K0.date&&Y===K0.date&&+J===+Q)return{valid:!0,data:J};else return{valid:!1}}var B5=class extends T0{_parse(J){let{status:Q,ctx:X}=this._processInputParams(J),Y=(H,W)=>{if(zH(H)||zH(W))return S0;let G=PH(H.value,W.value);if(!G.valid)return V0(X,{code:q0.invalid_intersection_types}),S0;if($H(H)||$H(W))Q.dirty();return{status:Q.value,value:G.data}};if(X.common.async)return Promise.all([this._def.left._parseAsync({data:X.data,path:X.path,parent:X}),this._def.right._parseAsync({data:X.data,path:X.path,parent:X})]).then(([H,W])=>Y(H,W));else return Y(this._def.left._parseSync({data:X.data,path:X.path,parent:X}),this._def.right._parseSync({data:X.data,path:X.path,parent:X}))}};B5.create=(J,Q,X)=>{return new B5({left:J,right:Q,typeName:P0.ZodIntersection,...v0(X)})};var r6=class J extends T0{_parse(Q){let{status:X,ctx:Y}=this._processInputParams(Q);if(Y.parsedType!==K0.array)return V0(Y,{code:q0.invalid_type,expected:K0.array,received:Y.parsedType}),S0;if(Y.data.length<this._def.items.length)return V0(Y,{code:q0.too_small,minimum:this._def.items.length,inclusive:!0,exact:!1,type:"array"}),S0;if(!this._def.rest&&Y.data.length>this._def.items.length)V0(Y,{code:q0.too_big,maximum:this._def.items.length,inclusive:!0,exact:!1,type:"array"}),X.dirty();let W=[...Y.data].map((G,j)=>{let N=this._def.items[j]||this._def.rest;if(!N)return null;return N._parse(new E6(Y,G,Y.path,j))}).filter((G)=>!!G);if(Y.common.async)return Promise.all(W).then((G)=>{return C1.mergeArray(X,G)});else return C1.mergeArray(X,W)}get items(){return this._def.items}rest(Q){return new J({...this._def,rest:Q})}};r6.create=(J,Q)=>{if(!Array.isArray(J))throw Error("You must pass an array of schemas to z.tuple([ ... ])");return new r6({items:J,typeName:P0.ZodTuple,rest:null,...v0(Q)})};var IE=class J extends T0{get keySchema(){return this._def.keyType}get valueSchema(){return this._def.valueType}_parse(Q){let{status:X,ctx:Y}=this._processInputParams(Q);if(Y.parsedType!==K0.object)return V0(Y,{code:q0.invalid_type,expected:K0.object,received:Y.parsedType}),S0;let H=[],W=this._def.keyType,G=this._def.valueType;for(let j in Y.data)H.push({key:W._parse(new E6(Y,j,Y.path,j)),value:G._parse(new E6(Y,Y.data[j],Y.path,j)),alwaysSet:j in Y.data});if(Y.common.async)return C1.mergeObjectAsync(X,H);else return C1.mergeObjectSync(X,H)}get element(){return this._def.valueType}static create(Q,X,Y){if(X instanceof T0)return new J({keyType:Q,valueType:X,typeName:P0.ZodRecord,...v0(Y)});return new J({keyType:N7.create(),valueType:Q,typeName:P0.ZodRecord,...v0(X)})}},R4=class extends T0{get keySchema(){return this._def.keyType}get valueSchema(){return this._def.valueType}_parse(J){let{status:Q,ctx:X}=this._processInputParams(J);if(X.parsedType!==K0.map)return V0(X,{code:q0.invalid_type,expected:K0.map,received:X.parsedType}),S0;let Y=this._def.keyType,H=this._def.valueType,W=[...X.data.entries()].map(([G,j],N)=>{return{key:Y._parse(new E6(X,G,X.path,[N,"key"])),value:H._parse(new E6(X,j,X.path,[N,"value"]))}});if(X.common.async){let G=new Map;return Promise.resolve().then(async()=>{for(let j of W){let N=await j.key,V=await j.value;if(N.status==="aborted"||V.status==="aborted")return S0;if(N.status==="dirty"||V.status==="dirty")Q.dirty();G.set(N.value,V.value)}return{status:Q.value,value:G}})}else{let G=new Map;for(let j of W){let{key:N,value:V}=j;if(N.status==="aborted"||V.status==="aborted")return S0;if(N.status==="dirty"||V.status==="dirty")Q.dirty();G.set(N.value,V.value)}return{status:Q.value,value:G}}}};R4.create=(J,Q,X)=>{return new R4({valueType:Q,keyType:J,typeName:P0.ZodMap,...v0(X)})};var E4=class J extends T0{_parse(Q){let{status:X,ctx:Y}=this._processInputParams(Q);if(Y.parsedType!==K0.set)return V0(Y,{code:q0.invalid_type,expected:K0.set,received:Y.parsedType}),S0;let H=this._def;if(H.minSize!==null){if(Y.data.size<H.minSize.value)V0(Y,{code:q0.too_small,minimum:H.minSize.value,type:"set",inclusive:!0,exact:!1,message:H.minSize.message}),X.dirty()}if(H.maxSize!==null){if(Y.data.size>H.maxSize.value)V0(Y,{code:q0.too_big,maximum:H.maxSize.value,type:"set",inclusive:!0,exact:!1,message:H.maxSize.message}),X.dirty()}let W=this._def.valueType;function G(N){let V=new Set;for(let L of N){if(L.status==="aborted")return S0;if(L.status==="dirty")X.dirty();V.add(L.value)}return{status:X.value,value:V}}let j=[...Y.data.values()].map((N,V)=>W._parse(new E6(Y,N,Y.path,V)));if(Y.common.async)return Promise.all(j).then((N)=>G(N));else return G(j)}min(Q,X){return new J({...this._def,minSize:{value:Q,message:E0.toString(X)}})}max(Q,X){return new J({...this._def,maxSize:{value:Q,message:E0.toString(X)}})}size(Q,X){return this.min(Q,X).max(Q,X)}nonempty(Q){return this.min(1,Q)}};E4.create=(J,Q)=>{return new E4({valueType:J,minSize:null,maxSize:null,typeName:P0.ZodSet,...v0(Q)})};var _E=class J extends T0{constructor(){super(...arguments);this.validate=this.implement}_parse(Q){let{ctx:X}=this._processInputParams(Q);if(X.parsedType!==K0.function)return V0(X,{code:q0.invalid_type,expected:K0.function,received:X.parsedType}),S0;function Y(j,N){return B4({data:j,path:X.path,errorMaps:[X.common.contextualErrorMap,X.schemaErrorMap,M4(),F7].filter((V)=>!!V),issueData:{code:q0.invalid_arguments,argumentsError:N}})}function H(j,N){return B4({data:j,path:X.path,errorMaps:[X.common.contextualErrorMap,X.schemaErrorMap,M4(),F7].filter((V)=>!!V),issueData:{code:q0.invalid_return_type,returnTypeError:N}})}let W={errorMap:X.common.contextualErrorMap},G=X.data;if(this._def.returns instanceof K7){let j=this;return k1(async function(...N){let V=new B6([]),L=await j._def.args.parseAsync(N,W).catch((E)=>{throw V.addIssue(Y(N,E)),V}),B=await Reflect.apply(G,this,L);return await j._def.returns._def.type.parseAsync(B,W).catch((E)=>{throw V.addIssue(H(B,E)),V})})}else{let j=this;return k1(function(...N){let V=j._def.args.safeParse(N,W);if(!V.success)throw new B6([Y(N,V.error)]);let L=Reflect.apply(G,this,V.data),B=j._def.returns.safeParse(L,W);if(!B.success)throw new B6([H(L,B.error)]);return B.data})}}parameters(){return this._def.args}returnType(){return this._def.returns}args(...Q){return new J({...this._def,args:r6.create(Q).rest(s8.create())})}returns(Q){return new J({...this._def,returns:Q})}implement(Q){return this.parse(Q)}strictImplement(Q){return this.parse(Q)}static create(Q,X,Y){return new J({args:Q?Q:r6.create([]).rest(s8.create()),returns:X||s8.create(),typeName:P0.ZodFunction,...v0(Y)})}},L5=class extends T0{get schema(){return this._def.getter()}_parse(J){let{ctx:Q}=this._processInputParams(J);return this._def.getter()._parse({data:Q.data,path:Q.path,parent:Q})}};L5.create=(J,Q)=>{return new L5({getter:J,typeName:P0.ZodLazy,...v0(Q)})};var U5=class extends T0{_parse(J){if(J.data!==this._def.value){let Q=this._getOrReturnCtx(J);return V0(Q,{received:Q.data,code:q0.invalid_literal,expected:this._def.value}),S0}return{status:"valid",value:J.data}}get value(){return this._def.value}};U5.create=(J,Q)=>{return new U5({value:J,typeName:P0.ZodLiteral,...v0(Q)})};function bE(J,Q){return new A5({values:J,typeName:P0.ZodEnum,...v0(Q)})}var A5=class J extends T0{constructor(){super(...arguments);X5.set(this,void 0)}_parse(Q){if(typeof Q.data!=="string"){let X=this._getOrReturnCtx(Q),Y=this._def.values;return V0(X,{expected:l0.joinValues(Y),received:X.parsedType,code:q0.invalid_type}),S0}if(!L4(this,X5,"f"))SE(this,X5,new Set(this._def.values),"f");if(!L4(this,X5,"f").has(Q.data)){let X=this._getOrReturnCtx(Q),Y=this._def.values;return V0(X,{received:X.data,code:q0.invalid_enum_value,options:Y}),S0}return k1(Q.data)}get options(){return this._def.values}get enum(){let Q={};for(let X of this._def.values)Q[X]=X;return Q}get Values(){let Q={};for(let X of this._def.values)Q[X]=X;return Q}get Enum(){let Q={};for(let X of this._def.values)Q[X]=X;return Q}extract(Q,X=this._def){return J.create(Q,{...this._def,...X})}exclude(Q,X=this._def){return J.create(this.options.filter((Y)=>!Q.includes(Y)),{...this._def,...X})}};X5=new WeakMap;A5.create=bE;var O5=class extends T0{constructor(){super(...arguments);Y5.set(this,void 0)}_parse(J){let Q=l0.getValidEnumValues(this._def.values),X=this._getOrReturnCtx(J);if(X.parsedType!==K0.string&&X.parsedType!==K0.number){let Y=l0.objectValues(Q);return V0(X,{expected:l0.joinValues(Y),received:X.parsedType,code:q0.invalid_type}),S0}if(!L4(this,Y5,"f"))SE(this,Y5,new Set(l0.getValidEnumValues(this._def.values)),"f");if(!L4(this,Y5,"f").has(J.data)){let Y=l0.objectValues(Q);return V0(X,{received:X.data,code:q0.invalid_enum_value,options:Y}),S0}return k1(J.data)}get enum(){return this._def.values}};Y5=new WeakMap;O5.create=(J,Q)=>{return new O5({values:J,typeName:P0.ZodNativeEnum,...v0(Q)})};var K7=class extends T0{unwrap(){return this._def.type}_parse(J){let{ctx:Q}=this._processInputParams(J);if(Q.parsedType!==K0.promise&&Q.common.async===!1)return V0(Q,{code:q0.invalid_type,expected:K0.promise,received:Q.parsedType}),S0;let X=Q.parsedType===K0.promise?Q.data:Promise.resolve(Q.data);return k1(X.then((Y)=>{return this._def.type.parseAsync(Y,{path:Q.path,errorMap:Q.common.contextualErrorMap})}))}};K7.create=(J,Q)=>{return new K7({type:J,typeName:P0.ZodPromise,...v0(Q)})};var L6=class extends T0{innerType(){return this._def.schema}sourceType(){return this._def.schema._def.typeName===P0.ZodEffects?this._def.schema.sourceType():this._def.schema}_parse(J){let{status:Q,ctx:X}=this._processInputParams(J),Y=this._def.effect||null,H={addIssue:(W)=>{if(V0(X,W),W.fatal)Q.abort();else Q.dirty()},get path(){return X.path}};if(H.addIssue=H.addIssue.bind(H),Y.type==="preprocess"){let W=Y.transform(X.data,H);if(X.common.async)return Promise.resolve(W).then(async(G)=>{if(Q.value==="aborted")return S0;let j=await this._def.schema._parseAsync({data:G,path:X.path,parent:X});if(j.status==="aborted")return S0;if(j.status==="dirty")return j7(j.value);if(Q.value==="dirty")return j7(j.value);return j});else{if(Q.value==="aborted")return S0;let G=this._def.schema._parseSync({data:W,path:X.path,parent:X});if(G.status==="aborted")return S0;if(G.status==="dirty")return j7(G.value);if(Q.value==="dirty")return j7(G.value);return G}}if(Y.type==="refinement"){let W=(G)=>{let j=Y.refinement(G,H);if(X.common.async)return Promise.resolve(j);if(j instanceof Promise)throw Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");return G};if(X.common.async===!1){let G=this._def.schema._parseSync({data:X.data,path:X.path,parent:X});if(G.status==="aborted")return S0;if(G.status==="dirty")Q.dirty();return W(G.value),{status:Q.value,value:G.value}}else return this._def.schema._parseAsync({data:X.data,path:X.path,parent:X}).then((G)=>{if(G.status==="aborted")return S0;if(G.status==="dirty")Q.dirty();return W(G.value).then(()=>{return{status:Q.value,value:G.value}})})}if(Y.type==="transform")if(X.common.async===!1){let W=this._def.schema._parseSync({data:X.data,path:X.path,parent:X});if(!a8(W))return W;let G=Y.transform(W.value,H);if(G instanceof Promise)throw Error("Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.");return{status:Q.value,value:G}}else return this._def.schema._parseAsync({data:X.data,path:X.path,parent:X}).then((W)=>{if(!a8(W))return W;return Promise.resolve(Y.transform(W.value,H)).then((G)=>({status:Q.value,value:G}))});l0.assertNever(Y)}};L6.create=(J,Q,X)=>{return new L6({schema:J,typeName:P0.ZodEffects,effect:Q,...v0(X)})};L6.createWithPreprocess=(J,Q,X)=>{return new L6({schema:Q,effect:{type:"preprocess",transform:J},typeName:P0.ZodEffects,...v0(X)})};var R6=class extends T0{_parse(J){if(this._getType(J)===K0.undefined)return k1(void 0);return this._def.innerType._parse(J)}unwrap(){return this._def.innerType}};R6.create=(J,Q)=>{return new R6({innerType:J,typeName:P0.ZodOptional,...v0(Q)})};var t6=class extends T0{_parse(J){if(this._getType(J)===K0.null)return k1(null);return this._def.innerType._parse(J)}unwrap(){return this._def.innerType}};t6.create=(J,Q)=>{return new t6({innerType:J,typeName:P0.ZodNullable,...v0(Q)})};var R5=class extends T0{_parse(J){let{ctx:Q}=this._processInputParams(J),X=Q.data;if(Q.parsedType===K0.undefined)X=this._def.defaultValue();return this._def.innerType._parse({data:X,path:Q.path,parent:Q})}removeDefault(){return this._def.innerType}};R5.create=(J,Q)=>{return new R5({innerType:J,typeName:P0.ZodDefault,defaultValue:typeof Q.default==="function"?Q.default:()=>Q.default,...v0(Q)})};var E5=class extends T0{_parse(J){let{ctx:Q}=this._processInputParams(J),X={...Q,common:{...Q.common,issues:[]}},Y=this._def.innerType._parse({data:X.data,path:X.path,parent:{...X}});if(W5(Y))return Y.then((H)=>{return{status:"valid",value:H.status==="valid"?H.value:this._def.catchValue({get error(){return new B6(X.common.issues)},input:X.data})}});else return{status:"valid",value:Y.status==="valid"?Y.value:this._def.catchValue({get error(){return new B6(X.common.issues)},input:X.data})}}removeCatch(){return this._def.innerType}};E5.create=(J,Q)=>{return new E5({innerType:J,typeName:P0.ZodCatch,catchValue:typeof Q.catch==="function"?Q.catch:()=>Q.catch,...v0(Q)})};var D4=class extends T0{_parse(J){if(this._getType(J)!==K0.nan){let X=this._getOrReturnCtx(J);return V0(X,{code:q0.invalid_type,expected:K0.nan,received:X.parsedType}),S0}return{status:"valid",value:J.data}}};D4.create=(J)=>{return new D4({typeName:P0.ZodNaN,...v0(J)})};var QS=Symbol("zod_brand"),CH=class extends T0{_parse(J){let{ctx:Q}=this._processInputParams(J),X=Q.data;return this._def.type._parse({data:X,path:Q.path,parent:Q})}unwrap(){return this._def.type}},IH=class J extends T0{_parse(Q){let{status:X,ctx:Y}=this._processInputParams(Q);if(Y.common.async)return(async()=>{let W=await this._def.in._parseAsync({data:Y.data,path:Y.path,parent:Y});if(W.status==="aborted")return S0;if(W.status==="dirty")return X.dirty(),j7(W.value);else return this._def.out._parseAsync({data:W.value,path:Y.path,parent:Y})})();else{let H=this._def.in._parseSync({data:Y.data,path:Y.path,parent:Y});if(H.status==="aborted")return S0;if(H.status==="dirty")return X.dirty(),{status:"dirty",value:H.value};else return this._def.out._parseSync({data:H.value,path:Y.path,parent:Y})}}static create(Q,X){return new J({in:Q,out:X,typeName:P0.ZodPipeline})}},D5=class extends T0{_parse(J){let Q=this._def.innerType._parse(J),X=(Y)=>{if(a8(Y))Y.value=Object.freeze(Y.value);return Y};return W5(Q)?Q.then((Y)=>X(Y)):X(Q)}unwrap(){return this._def.innerType}};D5.create=(J,Q)=>{return new D5({innerType:J,typeName:P0.ZodReadonly,...v0(Q)})};function NE(J,Q){let X=typeof J==="function"?J(Q):typeof J==="string"?{message:J}:J;return typeof X==="string"?{message:X}:X}function vE(J,Q={},X){if(J)return V7.create().superRefine((Y,H)=>{var W,G;let j=J(Y);if(j instanceof Promise)return j.then((N)=>{var V,L;if(!N){let B=NE(Q,Y),U=(L=(V=B.fatal)!==null&&V!==void 0?V:X)!==null&&L!==void 0?L:!0;H.addIssue({code:"custom",...B,fatal:U})}});if(!j){let N=NE(Q,Y),V=(G=(W=N.fatal)!==null&&W!==void 0?W:X)!==null&&G!==void 0?G:!0;H.addIssue({code:"custom",...N,fatal:V})}return});return V7.create()}var XS={object:u1.lazycreate},P0;(function(J){J.ZodString="ZodString",J.ZodNumber="ZodNumber",J.ZodNaN="ZodNaN",J.ZodBigInt="ZodBigInt",J.ZodBoolean="ZodBoolean",J.ZodDate="ZodDate",J.ZodSymbol="ZodSymbol",J.ZodUndefined="ZodUndefined",J.ZodNull="ZodNull",J.ZodAny="ZodAny",J.ZodUnknown="ZodUnknown",J.ZodNever="ZodNever",J.ZodVoid="ZodVoid",J.ZodArray="ZodArray",J.ZodObject="ZodObject",J.ZodUnion="ZodUnion",J.ZodDiscriminatedUnion="ZodDiscriminatedUnion",J.ZodIntersection="ZodIntersection",J.ZodTuple="ZodTuple",J.ZodRecord="ZodRecord",J.ZodMap="ZodMap",J.ZodSet="ZodSet",J.ZodFunction="ZodFunction",J.ZodLazy="ZodLazy",J.ZodLiteral="ZodLiteral",J.ZodEnum="ZodEnum",J.ZodEffects="ZodEffects",J.ZodNativeEnum="ZodNativeEnum",J.ZodOptional="ZodOptional",J.ZodNullable="ZodNullable",J.ZodDefault="ZodDefault",J.ZodCatch="ZodCatch",J.ZodPromise="ZodPromise",J.ZodBranded="ZodBranded",J.ZodPipeline="ZodPipeline",J.ZodReadonly="ZodReadonly"})(P0||(P0={}));var YS=(J,Q={message:`Input not instance of ${J.name}`})=>vE((X)=>X instanceof J,Q),TE=N7.create,xE=G5.create,HS=D4.create,qS=j5.create,fE=F5.create,WS=N5.create,GS=U4.create,jS=V5.create,FS=K5.create,NS=V7.create,VS=s8.create,KS=l6.create,MS=O4.create,BS=i8.create,LS=u1.create,US=u1.strictCreate,OS=M5.create,RS=CE.create,ES=B5.create,DS=r6.create,AS=IE.create,zS=R4.create,$S=E4.create,PS=_E.create,SS=L5.create,ZS=U5.create,wS=A5.create,kS=O5.create,CS=K7.create,VE=L6.create,IS=R6.create,_S=t6.create,bS=L6.createWithPreprocess,vS=IH.create,TS=()=>TE().optional(),xS=()=>xE().optional(),fS=()=>fE().optional(),hS={string:(J)=>N7.create({...J,coerce:!0}),number:(J)=>G5.create({...J,coerce:!0}),boolean:(J)=>F5.create({...J,coerce:!0}),bigint:(J)=>j5.create({...J,coerce:!0}),date:(J)=>N5.create({...J,coerce:!0})},yS=S0,z1=Object.freeze({__proto__:null,defaultErrorMap:F7,setErrorMap:bP,getErrorMap:M4,makeIssue:B4,EMPTY_PATH:vP,addIssueToContext:V0,ParseStatus:C1,INVALID:S0,DIRTY:j7,OK:k1,isAborted:zH,isDirty:$H,isValid:a8,isAsync:W5,get util(){return l0},get objectUtil(){return AH},ZodParsedType:K0,getParsedType:g6,ZodType:T0,datetimeRegex:kE,ZodString:N7,ZodNumber:G5,ZodBigInt:j5,ZodBoolean:F5,ZodDate:N5,ZodSymbol:U4,ZodUndefined:V5,ZodNull:K5,ZodAny:V7,ZodUnknown:s8,ZodNever:l6,ZodVoid:O4,ZodArray:i8,ZodObject:u1,ZodUnion:M5,ZodDiscriminatedUnion:CE,ZodIntersection:B5,ZodTuple:r6,ZodRecord:IE,ZodMap:R4,ZodSet:E4,ZodFunction:_E,ZodLazy:L5,ZodLiteral:U5,ZodEnum:A5,ZodNativeEnum:O5,ZodPromise:K7,ZodEffects:L6,ZodTransformer:L6,ZodOptional:R6,ZodNullable:t6,ZodDefault:R5,ZodCatch:E5,ZodNaN:D4,BRAND:QS,ZodBranded:CH,ZodPipeline:IH,ZodReadonly:D5,custom:vE,Schema:T0,ZodSchema:T0,late:XS,get ZodFirstPartyTypeKind(){return P0},coerce:hS,any:NS,array:BS,bigint:qS,boolean:fE,date:WS,discriminatedUnion:RS,effect:VE,enum:wS,function:PS,instanceof:YS,intersection:ES,lazy:SS,literal:ZS,map:zS,nan:HS,nativeEnum:kS,never:KS,null:FS,nullable:_S,number:xE,object:LS,oboolean:fS,onumber:xS,optional:IS,ostring:TS,pipeline:vS,preprocess:bS,promise:CS,record:AS,set:$S,strictObject:US,string:TE,symbol:GS,transformer:VE,tuple:DS,undefined:jS,union:OS,unknown:VS,void:MS,NEVER:yS,ZodIssueCode:q0,quotelessJson:_P,ZodError:B6}),KE={name:"@imgly/background-removal",version:"1.7.0",description:"Background Removal in the Browser",keywords:["background-removal","client-side","data-privacy","image-segmentation","image-matting","onnx"],repository:{type:"git",url:"git+https://github.com/imgly/background-removal-js.git"},license:"SEE LICENSE IN LICENSE.md",author:{name:"IMG.LY GmbH",email:"support@img.ly",url:"https://img.ly"},bugs:{email:"support@img.ly"},source:"./src/index.ts",main:"./dist/index.cjs",module:"./dist/index.mjs",types:"./dist/src/index.d.ts",exports:{".":{require:"./dist/index.cjs",import:"./dist/index.mjs",types:"./dist/src/index.d.ts"}},homepage:"https://img.ly/showcases/cesdk/web/background-removal",files:["LICENSE.md","README.md","CHANGELOG.md","ThirdPartyLicenses.json","dist/","bin/"],scripts:{start:"pnpm run watch",clean:"npx rimraf dist",test:"true",resources:"node ../../scripts/package-resources.mjs","changelog:create":"node ../../scripts/changelog/changelog-create.mjs","changelog:generate":"node ../../scripts/changelog/changelog-generate.mjs",build:"pnpm run clean && pnpm run types && pnpm run resources && pnpm run changelog:generate && node scripts/build.mjs",types:" npx tsc --declaration --emitDeclarationOnly --declarationDir dist --declarationMap",watch:"pnpm run clean && pnpm run resources && pnpm run changelog:generate && node scripts/watch.mjs","publish:latest":"pnpm publish --tag latest --access public","publish:next":"pnpm publish --tag next --access public","package:pack":"pnpm pack . --pack-destination ../../releases","check:all":"pnpm run check:pretty","check:pretty":"prettier --list-different './src/**/*.{ts,tsx}'",pretty:"prettier --write './src/**/*.{ts,tsx}'"},dependencies:{"lodash-es":"^4.17.21",ndarray:"~1.0.0",zod:"^3.23.8"},peerDependencies:{"onnxruntime-web":"1.21.0"},devDependencies:{"@types/lodash-es":"^4.17.12","@types/ndarray":"~1.0.14","@types/node":"~20.3.0",assert:"~2.0.0",esbuild:"~0.18.0",glob:"~10.3.0","npm-dts":"~1.3.0",process:"~0.11.0","ts-loader":"~9.4.0",tslib:"~2.5.0",typescript:"~5.1.0",util:"~0.12.0",webpack:"~5.85.0","webpack-cli":"~5.1.0"}},gS=z1.object({publicPath:z1.string().optional().describe("The public path to the wasm files and the onnx model.").default("https://staticimgly.com/@imgly/background-removal-data/${PACKAGE_VERSION}/dist/").transform((J)=>{return J.replace("${PACKAGE_NAME}",KE.name).replace("${PACKAGE_VERSION}",KE.version)}),debug:z1.boolean().default(!1).describe("Whether to enable debug logging."),rescale:z1.boolean().default(!0).describe("Whether to rescale the image."),device:z1.enum(["cpu","gpu"]).default("cpu").describe("The device to run the model on."),proxyToWorker:z1.boolean().default(!1).describe("Whether to proxy inference to a web worker."),fetchArgs:z1.any().default({}).describe("Arguments to pass to fetch when loading the model."),progress:z1.function().args(z1.string(),z1.number(),z1.number()).returns(z1.void()).describe("Progress callback.").optional(),model:z1.preprocess((J)=>{switch(J){case"large":return"isnet";case"small":return"isnet_quint8";case"medium":return"isnet_fp16";default:return J}},z1.enum(["isnet","isnet_fp16","isnet_quint8"])).default("medium"),output:z1.object({format:z1.enum(["image/png","image/jpeg","image/webp","image/x-rgba8","image/x-alpha8"]).default("image/png"),quality:z1.number().default(0.8)}).default({})}).default({}).transform((J)=>{if(J.debug)console.log("Config:",J);if(J.debug&&!J.progress){if(J.progress=J.progress??((Q,X,Y)=>{console.debug(`Downloading ${Q}: ${X} of ${Y}`)}),!crossOriginIsolated){if(J.debug)console.debug("Cross-Origin-Isolated is not enabled. Performance will be degraded. Please see  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer.")}}return J});function hE(J){return gS.parse(J??{})}var lS=A4(z4());async function mS(J){if(J.debug)console.debug("Loading model...",J.model);let Q=J.model,Y=await(await zE(`/models/${Q}`,J)).arrayBuffer();return await CP(Y,J)}async function pS(J){J=hE(J);let Q=await mS(J);return{config:J,session:{base:Q}}}async function _H(J,Q,X){let[H,W,G]=J.shape,j=!1,N=DH(J,1024,1024,!1),V=SP(N),L=await IP(X.base,[["input",V]],["output"],Q),B=(0,lS.default)(L[0].data,[1024,1024,1]),U=ZP(B);if(Q.rescale)return U=DH(U,W,H,!1),[U,J];else return[U,N]}var Z4=EP(pS,(J)=>JSON.stringify(J));async function cS(J){await Z4(J);return}async function dS(J,Q){let{config:X,session:Y}=await Z4(Q);if(X.progress)X.progress("compute:decode",0,4);let H=await q5(J,X);X.progress?.("compute:inference",1,4);let[W,G]=await _H(H,X,Y);X.progress?.("compute:mask",2,4);let j=G,[N,V]=j.shape,L=N*V;for(let U=0;U<L;U+=1)j.data[4*U+3]=W.data[U];X.progress?.("compute:encode",3,4);let B=await S4(j,X.output.quality,X.output.format);return X.progress?.("compute:encode",4,4),B}async function uS(J,Q){let{config:X,session:Y}=await Z4(Q),H=await q5(J,X),[W,G]=await _H(H,X,Y),j=G,[N,V,L]=j.shape,B=N*V;for(let E=0;E<B;E+=1)j.data[4*E+3]=255-W.data[E];return await S4(j,X.output.quality,X.output.format)}var oS=yE;async function yE(J,Q){let{config:X,session:Y}=await Z4(Q),H=await q5(J,X),[W,G,j]=H.shape,[N,V]=await _H(H,X,Y),L=G*W,B=H;for(let E=0;E<L;E+=1){let R=4*E,A=N.data[E];B.data[R]=255,B.data[R+1]=255,B.data[R+2]=255,B.data[R+3]=A}return await S4(B,X.output.quality,X.output.format)}async function sS(J,Q,X){X=hE(X);let Y=await q5(J,X),[H,W,G]=Y.shape,j=await q5(Q,X),[N,V,L]=j.shape,B=N!==H||V!==W?DH(j,W,H):j,U=W*H;for(let R=0;R<U;R+=1){let A=G*R,P=L*R;Y.data[A+3]=B.data[P+3]}return await S4(Y,X.output.quality,X.output.format)}/*! Bundled license information:

is-buffer/index.js:
  (*!
   * Determine if an object is a Buffer
   *
   * @author   Feross Aboukhadijeh <https://feross.org>
   * @license  MIT
   *)
*/var{alphamask:Kw,applySegmentationMask:Mw,preload:Bw,removeBackground:Lw,removeForeground:Uw,segmentForeground:Ow}=w4;var Ew=w4;export{Ow as segmentForeground,Uw as removeForeground,Lw as removeBackground,Bw as preload,Ew as default,Mw as applySegmentationMask,Kw as alphamask};
