import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export function createCourtyardDetails(scene,bankHeight=()=>.15){
 const group=new THREE.Group();group.name='Cedar courtyard furnishings';scene.add(group);let seed=731;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 function grain(){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle='#8a6748';ctx.fillRect(0,0,256,512);for(let i=0;i<1900;i++){const x=random()*256;ctx.strokeStyle=`rgba(${random()<.5?'42,27,17':'221,181,125'},${.025+random()*.13})`;ctx.lineWidth=.3+random()*1.5;ctx.beginPath();ctx.moveTo(x,0);for(let y=0;y<=512;y+=16)ctx.lineTo(x+Math.sin(y*.022+i)*(.3+random()*1.8),y);ctx.stroke();}const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;return t;}
 const cedar=new THREE.MeshStandardMaterial({map:grain(),color:'#ddd1bd',roughness:.72});const cedarEnd=cedar.clone();cedarEnd.color.set('#bd9c72');const iron=new THREE.MeshStandardMaterial({color:'#334138',roughness:.57,metalness:.68});
 const stoneMap=new THREE.TextureLoader().load('/assets/terrain/dark_rock_02/dark_rock_02_diffuse_1k.jpg');stoneMap.colorSpace=THREE.SRGBColorSpace;stoneMap.wrapS=stoneMap.wrapT=THREE.RepeatWrapping;stoneMap.anisotropy=8;
 const granite=new THREE.MeshStandardMaterial({map:stoneMap,color:'#d5d3c5',roughness:.91});const terra=new THREE.MeshStandardMaterial({color:'#a87351',roughness:.92});
 const add=(parent,geometry,material,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
 const box=(parent,w,h,d,mat,x,y,z,r=.025)=>add(parent,new RoundedBoxGeometry(w,h,d,3,Math.min(r,h*.22,w*.22,d*.22)),mat,x,y,z);
 // Human-scale cedar bench, five separated slats with inset bolts and slim steel brackets.
 const bench=new THREE.Group();bench.position.set(6,Math.max(.14,bankHeight(6,-10.5)),-10.5);bench.rotation.y=.06;group.add(bench);
 for(let i=0;i<5;i++)box(bench,1.85,.052,.104,cedar,0,.47,-.24+i*.12,.013);
 for(const x of [-.65,.65]){box(bench,.07,.42,.055,iron,x,.235,-.23,.007);box(bench,.07,.42,.055,iron,x,.235,.23,.007);box(bench,.085,.055,.57,iron,x,.432,0,.007);box(bench,.1,.037,.62,iron,x,.033,0,.005);}
 for(let i=0;i<3;i++){const rail=box(bench,1.85,.095,.042,cedar,0,.68+i*.115,-.305-i*.019,.011);rail.rotation.x=-.13;}
 for(const x of [-.68,.68]){const back=box(bench,.048,.64,.045,iron,x,.6,-.315,.006);back.rotation.x=-.12;}
 const boltGeo=new THREE.CylinderGeometry(.009,.009,.005,10);for(const x of [-.68,.68])for(let i=0;i<5;i++)add(bench,boltGeo,iron,x,.499,-.24+i*.12);
 // Quiet stone lantern: open chamber, four slender supports and a sweeping hip roof.
 const lantern=new THREE.Group();lantern.position.set(-4.7,Math.max(.12,bankHeight(-4.7,-9.7)),-9.7);group.add(lantern);
 box(lantern,.55,.11,.55,granite,0,.055,0,.035);add(lantern,new THREE.CylinderGeometry(.11,.16,.40,16),granite,0,.30,0);box(lantern,.39,.07,.39,granite,0,.53,0,.02);
 for(const x of [-.13,.13])for(const z of [-.13,.13])box(lantern,.045,.23,.045,granite,x,.675,z,.009);
 box(lantern,.39,.055,.39,granite,0,.805,0,.018);
 const roofPoints=[new THREE.Vector2(0,0),new THREE.Vector2(.32,0),new THREE.Vector2(.31,.035),new THREE.Vector2(.19,.14),new THREE.Vector2(.09,.205),new THREE.Vector2(0,.23)];
 const roof=add(lantern,new THREE.LatheGeometry(roofPoints,4),granite,0,.82,0);roof.rotation.y=Math.PI/4;
 add(lantern,new THREE.SphereGeometry(.05,12,8),granite,0,1.085,0);
 const warm=new THREE.MeshStandardMaterial({color:'#ead6a0',emissive:'#dfaa55',emissiveIntensity:.22,roughness:.75});add(lantern,new THREE.CylinderGeometry(.045,.04,.10,12),warm,0,.615,0);
 // A partial cedar screen establishes an enclosing courtyard without hiding the tree canopy.
 const screen=new THREE.Group();screen.position.set(-1,Math.max(.16,bankHeight(-1,-16.4)),-16.4);group.add(screen);
 for(const x of [-3,-1,1,3]){box(screen,.12,2.25,.13,cedarEnd,x,1.125,0,.018);box(screen,.20,.05,.2,cedarEnd,x,2.275,0,.011);}
 for(const y of [.35,1.9])box(screen,6.15,.085,.075,cedarEnd,0,y,.065,.012);
 for(let i=0;i<43;i++)box(screen,.064,1.72,.038,cedar,-2.95+i*.14,1.13,0,.008);
 box(screen,6.4,.11,.20,cedarEnd,0,2.16,0,.018);
 // A thin, open timber arbor over just one end of the screen.
 for(const x of [-3,-1]){box(screen,.11,2.25,.11,cedarEnd,x,1.125,1.05,.012);box(screen,.085,.09,1.6,cedarEnd,x,2.18,.58,.015);}
 for(let i=0;i<5;i++)box(screen,2.4,.055,.05,cedar,-2,2.25,-.03+i*.31,.009);
 const leafMat=new THREE.MeshStandardMaterial({color:'#557447',roughness:.7,side:THREE.DoubleSide});const leafGeo=new THREE.BufferGeometry();leafGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.035,.005,.045,0,.02,.055,.035,.005,.045,0,0,.12],3));leafGeo.setIndex([0,1,2,0,2,3,1,4,2,2,4,3]);leafGeo.computeVertexNormals();
 for(const [x,z,scale] of [[-3.6,-10.1,.85],[7.5,-10.7,1.0]]){const pot=new THREE.Group();pot.position.set(x,Math.max(.12,bankHeight(x,z)),z);pot.scale.setScalar(scale);group.add(pot);const profile=[new THREE.Vector2(.15,0),new THREE.Vector2(.18,.035),new THREE.Vector2(.23,.38),new THREE.Vector2(.25,.39),new THREE.Vector2(.25,.43),new THREE.Vector2(.216,.43),new THREE.Vector2(.204,.38),new THREE.Vector2(.14,.055)];add(pot,new THREE.LatheGeometry(profile,32),terra);add(pot,new THREE.CylinderGeometry(.207,.207,.015,24),new THREE.MeshStandardMaterial({color:'#352e20',roughness:1}),0,.37,0);
  const leaves=new THREE.InstancedMesh(leafGeo,leafMat,170);const dummy=new THREE.Object3D();for(let i=0;i<170;i++){const a=random()*6.28,r=Math.sqrt(random())*.32;dummy.position.set(Math.cos(a)*r,.40+Math.sqrt(Math.max(0,.12-r*r))*.75+random()*.10,Math.sin(a)*r);dummy.rotation.set(-.65+random()*.8,a,random()*.3);dummy.scale.setScalar(.7+random()*.65);dummy.updateMatrix();leaves.setMatrixAt(i,dummy.matrix);}leaves.castShadow=true;leaves.receiveShadow=true;pot.add(leaves);}
 // Discreet stone pads lead to the bench, aligned to the existing walkway.
 for(let i=0;i<5;i++){const x=2.8+i*.64,z=-9.35;box(group,.50,.035,.43,granite,x,Math.max(.14,bankHeight(x,z))+.014,z,.027);}
 const chime=new THREE.Group();chime.position.set(-3.02,screen.position.y+2.11,-15.55);group.add(chime);
 const cord=add(chime,new THREE.CylinderGeometry(.002,.002,.19,5),iron,0,-.095,0);const bellMat=new THREE.MeshStandardMaterial({color:'#acd2c4',roughness:.18,metalness:.15,transparent:true,opacity:.65,side:THREE.DoubleSide});
 const bell=add(chime,new THREE.SphereGeometry(.067,20,12,0,Math.PI*2,0,Math.PI*.7),bellMat,0,-.25,0);bell.scale.y=1.2;box(chime,.024,.16,.001,new THREE.MeshStandardMaterial({color:'#f3dfb7',side:THREE.DoubleSide,roughness:.9}),0,-.43,0,.0002);
 return {group,update(dt,time){chime.rotation.z=Math.sin(time*.85)*.035+Math.sin(time*1.41)*.013;chime.rotation.x=Math.sin(time*.67)*.028;}};
}
