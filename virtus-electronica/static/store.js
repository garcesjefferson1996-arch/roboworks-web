import {filamentIntro,declarations,colorOptions,finishes,printerGuide} from './filaments.js';
import {serviceCards,servicePage} from './services.js';
import {esc,money,icon,modal,closeModal} from './ui.js';
import {showroom,bindShowroom} from './showroom.js';
import config from './config.js';

let products=[];
let cart=[];
try { const stored=JSON.parse(localStorage.getItem('virtus.static.cart')||'[]'); if(Array.isArray(stored)) cart=stored; } catch {}
const image=p=>p.images?.find(i=>i.kind==='image')?.url||'./assets/favicon.svg';
const find=id=>products.find(p=>p.id===id);
const lineKey=l=>JSON.stringify([l.id,l.color||'']);
const lineName=l=>find(l.id).name+(l.color?' · '+l.color:'');
const price=(p,q=1)=>Number.isInteger(p.price)?money(p.price*q):"Consultar precio";
const totalLabel=()=>cart.some(l=>!Number.isInteger(find(l.id).price))?"Por cotizar":money(total());
const total=()=>cart.reduce((sum,line)=>sum+find(line.id).price*line.quantity,0);
const save=()=>{try{localStorage.setItem('virtus.static.cart',JSON.stringify(cart));}catch{} header();};
const wa=text=>`https://wa.me/${config.whatsapp}?text=${encodeURIComponent(text)}`;
function header(){
 document.querySelector('#header').innerHTML=`<div class="static-nav wrap"><a class="logo" href="#/" aria-label="VIRTUS Electrónica, inicio"><span class="${config.logoCropped?'logo-image':'static-logo'}"><img src="${esc(config.logo)}" alt="Virtus"></span><span class="logo-sub">ELECTRÓNICA</span></a><nav aria-label="Navegación principal"><a href="#/catalogo">Productos</a><a href="#/kits">Kits</a><a href="#/filamentos">Filamentos</a><a href="#/impresion-3d">Impresión 3D</a><a href="#/corte-laser">Corte láser</a><a href="#/impresoras-3d">Impresoras 3D</a><a href="${esc(config.home)}">Virtus Robótica ${icon('arrow')}</a></nav><button class="icon-button" data-cart aria-label="Abrir carrito">${icon('bag')}<span class="static-count">${cart.reduce((s,l)=>s+l.quantity,0)}</span></button></div>`;
}
function card(p){return `<article class="glass-product"><button data-product="${esc(p.id)}" class="glass-image" aria-label="Ver ${esc(p.name)}"><img src="${esc(image(p))}" alt="${esc(p.name)}" loading="lazy"></button><span class="eyebrow">${esc(p.category)}</span><h2><button data-product="${esc(p.id)}">${esc(p.name)}</button></h2><div class="glass-price"><strong>${price(p)}</strong><button class="showroom-add" data-add="${esc(p.id)}" aria-label="Añadir ${esc(p.name)}">${icon('plus')}</button></div><small>Precio por unidad · Disponibilidad por confirmar${p.illustrative?" · Imagen ilustrativa":""}</small></article>`;}
function render(){
 closeModal(); const path=location.hash.slice(1)||'/'; const main=document.querySelector('#main');
 if(path==='/'){
  const featured=products.filter(p=>p.featured);
  main.innerHTML=showroom(featured.length?featured:products.slice(0,4)).replaceAll('href="/productos"','href="#/catalogo"').replaceAll('href="/kits"','href="#/kits"').replaceAll('href="/instituciones"',`href="${esc(wa('Hola, quisiera información de kits para mi institución.'))}"`);
  main.insertAdjacentHTML("beforeend", serviceCards()+`<section class="wrap">${filamentIntro().replaceAll('<h1>','<h2>').replaceAll('</h1>','</h2>')}</section>`);
  bindShowroom(featured.length?featured:products.slice(0,4));
 } else if(path==='/filamentos'){
  main.innerHTML=`<section class="wrap static-catalog">${filamentIntro()}<div class="static-grid">${products.filter(p=>p.category==='Filamentos SKP3D').map(card).join('')}</div>${declarations()}${finishes()}</section>`;
 } else if(path==='/impresoras-3d'){
  main.innerHTML=`<section class="wrap static-catalog"><span class="eyebrow">CREA DESDE TU PROPIO ESPACIO</span><h1>Impresoras 3D</h1><p>Tu próximo proyecto empieza aquí. Explora las características y prepara tu pedido por WhatsApp.</p><div class="static-grid">${products.filter(p=>p.category==='Impresoras 3D').map(card).join('')}</div>${printerGuide()}</section>`;
 } else if(servicePage(path)){
  main.innerHTML=servicePage(path);
 } else if(path.startsWith('/producto/')){
  const p=products.find(p=>p.slug===decodeURIComponent(path.slice(10)));
  main.innerHTML=p?`<section class="static-detail wrap"><a href="#/catalogo" class="text-link">← Volver al catálogo</a><div class="glass-detail"><div class="detail-art"><img src="${esc(image(p))}" alt="${esc(p.name)}">${(p.images||[]).slice(1).map(i=>`<figure><img src="${esc(i.url)}" alt="${esc(i.alt)}"><figcaption>${esc(i.alt)}</figcaption></figure>`).join("")}</div><div><span class="eyebrow">${esc(p.category)}</span><h1>${esc(p.name)}</h1><p>${esc(p.description)}</p>${colorOptions(p)}<dl>${Object.entries(p.details?.specifications||{}).map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${p.details?.features?.length?`<ul>${p.details.features.map(f=>`<li>${esc(f)}</li>`).join("")}</ul>`:""}${p.details?.note?`<p class="small">${esc(p.details.note)}</p>`:''}${p.details?.sources?.length?`<p class="small">${p.details.sources.map(s=>`<a class="text-link" href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)} ↗</a>`).join(' · ')}</p>`:''}<strong class="detail-price">${price(p)}</strong><p>Consulta disponibilidad y entrega antes de pagar.</p><button class="button" data-add="${esc(p.id)}">Añadir al pedido ${icon('plus')}</button><a class="text-link" data-product-whatsapp target="_blank" rel="noopener" href="${esc(wa(`Hola, quisiera consultar sobre ${p.name}${p.colors?.length?' · '+p.colors[0].name:''}. Precio publicado: ${price(p)}.`))}">Consultar por WhatsApp ${icon('arrow')}</a>${p.illustrative?'<p class="demo-note">Imagen ilustrativa. Confirma la versión y los accesorios incluidos por WhatsApp.</p>':''}${p.demo?'<p class="demo-note">Producto de ejemplo · Imagen y ficha conceptuales pendientes de confirmación.</p>':''}</div></div>${p.id==='filamento-skp3d-pla'?declarations():''}</section>`:`<section class="wrap section"><h1>Producto no encontrado</h1><a href="#/catalogo">Volver al catálogo</a></section>`;
 } else {
  main.innerHTML=`<section class="wrap static-catalog"><span class="eyebrow">ENCUENTRA TU PRÓXIMA IDEA</span><h1>${path==='/kits'?'Aprende creando.':'Piezas para imaginar.'}</h1><div class="static-filters"><label>Buscar<input id="search" type="search" placeholder="Placas, sensores, kits…"></label><label>Categoría<select id="category"><option value="">Todas</option>${[...new Set(products.map(p=>p.category))].map(c=>`<option>${esc(c)}</option>`).join('')}</select></label></div><p id="result-count" role="status"></p><div class="static-grid" id="results"></div></section>`;
  const filter=()=>{const query=document.querySelector('#search').value.toLocaleLowerCase('es');const category=document.querySelector('#category').value;const matches=products.filter(p=>(path!=='/kits'||p.details?.kit)&&(!category||p.category===category)&&`${p.name} ${p.description}`.toLocaleLowerCase('es').includes(query));document.querySelector('#results').innerHTML=matches.length?matches.map(card).join(''):'<p>No encontramos productos con esos filtros.</p>';document.querySelector('#result-count').textContent=`${matches.length} productos`;};
  document.querySelector('#search').oninput=filter;document.querySelector('#category').onchange=filter;filter();
 }
 document.title=`${main.querySelector('h1')?.textContent||'Catálogo'} | VIRTUS Electrónica`;
}
function message(){return `Hola VIRTUS Electrónica, quisiera consultar disponibilidad para este pedido:\n\n${cart.map(l=>`${l.quantity} × ${lineName(l)} — ${price(find(l.id),l.quantity)}`).join('\n')}\n\nTotal estimado: ${totalLabel()}\nPor favor, confirmen disponibilidad, costo de entrega y forma de pago.${cart.some(l=>find(l.id).demo)?'\nEstoy consultando productos del catálogo de demostración.':''}`;}
function showCart(){modal(`<div class="static-cart"><span class="eyebrow">TU PRÓXIMA IDEA</span><h2>Tu pedido</h2>${cart.length?`${cart.map(l=>`<div class="static-cart-line"><img src="${esc(image(find(l.id)))}" alt=""><div><strong>${esc(lineName(l))}</strong><p>${price(find(l.id),l.quantity)}</p><div class="quantity"><button data-quantity="${esc(lineKey(l))}" data-change="-1" aria-label="Disminuir ${esc(lineName(l))}">−</button><span>${l.quantity}</span><button data-quantity="${esc(lineKey(l))}" data-change="1" aria-label="Aumentar ${esc(lineName(l))}">+</button></div></div><button class="icon-button" data-remove="${esc(lineKey(l))}" aria-label="Quitar ${esc(lineName(l))}">${icon('trash')}</button></div>`).join('')}<div class="static-total"><span>Total estimado</span><strong>${totalLabel()}</strong></div><p>Confirmaremos existencias, envío y pago por WhatsApp. Añadir productos no reserva inventario.</p>${cart.some(l=>find(l.id).demo)?'<p class="demo-note">Este pedido incluye productos de ejemplo. Sus precios e imágenes aún deben verificarse.</p>':''}<a class="button full whatsapp-order" href="${esc(wa(message()))}" target="_blank" rel="noopener">Pedir por WhatsApp ${icon('arrow')}</a><p class="small">Se abrirá un mensaje preparado. Revísalo y envíalo en WhatsApp.</p>`:'<p>Tu carrito está vacío. Encuentra la primera pieza de tu proyecto.</p><a class="button" href="#/catalogo">Explorar productos</a>'}</div>`,'static-cart-dialog');}
document.addEventListener('click',e=>{
 const link=e.target.closest('a[data-link]'); if(link){const href=link.getAttribute('href');if(href?.startsWith('/productos/')){e.preventDefault();location.hash='/producto/'+href.split('/').pop();} }
 const b=e.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-cart'))showCart();
 if(b.dataset.product) location.hash='/producto/'+find(b.dataset.product).slug;
 if(b.dataset.add){const p=find(b.dataset.add);if(!p)return;if(p.colors?.length&&!document.querySelector('#product-color')){location.hash='/producto/'+p.slug;return;}const color=document.querySelector('#product-color')?.value||'';const line=cart.find(l=>l.id===p.id&&(l.color||'')===color);if(line)line.quantity=Math.min(99,line.quantity+1);else cart.push({id:p.id,quantity:1,color});save();showCart();}
 if(b.dataset.quantity){const line=cart.find(l=>lineKey(l)===b.dataset.quantity);if(line)line.quantity=Math.max(1,Math.min(99,line.quantity+Number(b.dataset.change)));save();showCart();}
 if(b.dataset.remove){cart=cart.filter(l=>lineKey(l)!==b.dataset.remove);save();showCart();}
});
document.addEventListener('change',e=>{if(e.target.id==='product-color'){const p=products.find(p=>'/producto/'+p.slug===location.hash.slice(1));if(p)document.querySelector('[data-product-whatsapp]').href=wa(`Hola, quisiera consultar sobre ${p.name} · ${e.target.value}. Precio publicado: ${price(p)}.`);}});
window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);document.querySelector('#main').focus();});
async function init(){try{
 const response=await fetch('./products.json');if(!response.ok)throw new Error('Catálogo no disponible');products=(await response.json()).filter(p=>p.active!==0);
 products.forEach(p=>{p.images?.forEach(i=>{if(i.url.startsWith('/assets/'))i.url='.'+i.url;});});
 cart=cart.filter(l=>l && find(l.id)&&Number.isInteger(l.quantity)&&l.quantity>0&&l.quantity<=99&&(!l.color||find(l.id).colors?.some(c=>c.name===l.color)));
 if(config.background)document.body.style.setProperty('--store-background',`url(${JSON.stringify(config.background)})`);
 header();document.querySelector('#footer').innerHTML=`<div class="wrap static-footer"><span>VIRTUS Electrónica · Ecuador</span><a href="${esc(wa('Hola, quisiera información sobre VIRTUS Electrónica.'))}" target="_blank" rel="noopener">Hablemos por WhatsApp ↗</a><a href="${esc(config.home)}">Virtus Robótica ↗</a><small>Consulta precios, disponibilidad y condiciones de entrega por WhatsApp.</small></div>`;render();
}catch{document.querySelector('#main').innerHTML='<section class="wrap section"><h1>No pudimos cargar el catálogo.</h1><p>Recarga la página para intentarlo de nuevo.</p></section>';}}
init();
