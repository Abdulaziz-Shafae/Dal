import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../public/assets/', import.meta.url));
const fontRoot = fileURLToPath(new URL('../public/fonts/', import.meta.url));
// Font sizes measured with the existing DAL font to fit the original text areas.
const fittedSizes = {
  "hero-phone/en/574/71.75/Group RYD-4827": 25,
  "hero-phone/en/579/107.25/4 members": 18,
  "hero-phone/en/210/88.25/Weak signal": 17.6,
  "hero-phone/en/368/255/Plaza": 26,
  "hero-phone/en/191.5/321.36/Abdullah": 18,
  "hero-phone/en/690/253.75/Ghaida": 29,
  "hero-phone/en/693/293.5/47 m · 12 s ago": 24,
  "hero-phone/en/346.5/449.82/Abdulaziz": 17.7,
  "hero-phone/en/657.5/551.63/Falwa": 17,
  "hero-phone/en/231.5/715.09/Ghaida": 17,
  "hero-phone/en/215/568.25/Entrance 1": 13.4,
  "hero-phone/en/572/538.75/Entrance 2": 12.8,
  "hero-phone/en/416.5/854/Expo 2030": 25.8,
  "hero-phone/en/542.5/840.09/You": 20,
  "hero-phone/en/416.5/957.75/Saudi Pavilion": 28,
  "hero-phone/en/678/1086/Where is your group?": 20.6,
  "hero-phone/en/229.5/1122/Met Falwa": 28,
  "hero-phone/en/185.5/1240.25/Abdulaziz": 21.8,
  "hero-phone/en/422/1241.75/Falwa": 22,
  "hero-phone/en/629/1241.75/Ghaida": 22,
  "hero-phone/en/186.5/1275/74 m": 21,
  "hero-phone/en/363/1275/49 m · 30 s ago": 20,
  "hero-phone/en/579/1275/47 m · 12 s ago": 20,
  "hero-phone/fr/574/71.75/Groupe RYD-4827": 25,
  "hero-phone/fr/579/107.25/4 membres": 18,
  "hero-phone/fr/210/88.25/Signal faible": 17.2,
  "hero-phone/fr/368/255/Place": 26,
  "hero-phone/fr/191.5/321.36/Abdullah": 18,
  "hero-phone/fr/690/253.75/Ghaida": 29,
  "hero-phone/fr/693/293.5/47 m · il y a 12 s": 24,
  "hero-phone/fr/346.5/449.82/Abdulaziz": 17.7,
  "hero-phone/fr/657.5/551.63/Falwa": 17,
  "hero-phone/fr/231.5/715.09/Ghaida": 17,
  "hero-phone/fr/215/568.25/Entrée 1": 17.3,
  "hero-phone/fr/572/538.75/Entrée 2": 16.4,
  "hero-phone/fr/416.5/854/Expo 2030": 25.8,
  "hero-phone/fr/542.5/840.09/Vous": 18.2,
  "hero-phone/fr/416.5/957.75/Pavillon saoudien": 24,
  "hero-phone/fr/678/1086/Où est votre groupe ?": 20.7,
  "hero-phone/fr/229.5/1122/Rencontre avec Falwa": 20.9,
  "hero-phone/fr/185.5/1240.25/Abdulaziz": 21.8,
  "hero-phone/fr/422/1241.75/Falwa": 22,
  "hero-phone/fr/629/1241.75/Ghaida": 22,
  "hero-phone/fr/186.5/1275/74 m": 21,
  "hero-phone/fr/363/1275/49 m · il y a 30 s": 20,
  "hero-phone/fr/579/1275/47 m · il y a 12 s": 20,
  "map-art/en/344/117.75/Plaza": 28,
  "map-art/en/120.5/208.2/Abdullah": 20,
  "map-art/en/316/370.93/Abdulaziz": 23,
  "map-art/en/716/504.2/Falwa": 23,
  "map-art/en/168.5/711.93/Ghaida": 22,
  "map-art/en/149/526.5/Entrance 1": 18.7,
  "map-art/en/610/485.25/Entrance 2": 18.7,
  "map-art/en/405.5/893.25/Expo 2030": 33,
  "map-art/en/566.5/873.47/You": 25,
  "map-art/en/420.5/1024.25/Saudi Pavilion": 36,
  "map-art/fr/344/117.75/Place": 28,
  "map-art/fr/120.5/208.2/Abdullah": 20,
  "map-art/fr/316/370.93/Abdulaziz": 23,
  "map-art/fr/716/504.2/Falwa": 23,
  "map-art/fr/168.5/711.93/Ghaida": 22,
  "map-art/fr/149/526.5/Entrée 1": 24.2,
  "map-art/fr/610/485.25/Entrée 2": 23.8,
  "map-art/fr/405.5/893.25/Expo 2030": 33,
  "map-art/fr/566.5/873.47/Vous": 25,
  "map-art/fr/420.5/1024.25/Pavillon saoudien": 32.4,
  "meeting-art/en/521/144.25/Meeting point": 26,
  "meeting-art/en/520.5/309/Entrance 1": 26.7,
  "meeting-art/en/852.5/782.5/Expo 2030": 40,
  "meeting-art/fr/521/144.25/Point de rencontre": 22.7,
  "meeting-art/fr/520.5/309/Entrée 1": 30,
  "meeting-art/fr/852.5/782.5/Expo 2030": 40
};
const fonts=['Regular','Bold'].map(weight=>`@font-face{font-family:Thmanyah;src:url(data:font/woff2;base64,${readFileSync(fontRoot+'thmanyahsans-'+weight+'.woff2').toString('base64')}) format('woff2');font-weight:${weight==='Bold'?700:400}}`).join('');
const copy={en:{group:'Group RYD-4827',members:'4 members',signal:'Weak signal',plaza:'Plaza',entrance1:'Entrance 1',entrance2:'Entrance 2',expo:'Expo 2030',saudi:'Saudi Pavilion',you:'You',where:'Where is your group?',met:'Met Falwa',update:'47 m · 12 s ago',firstTime:'74 m',secondTime:'49 m · 30 s ago',thirdTime:'47 m · 12 s ago',meeting:'Meeting point'},fr:{group:'Groupe RYD-4827',members:'4 membres',signal:'Signal faible',plaza:'Place',entrance1:'Entrée 1',entrance2:'Entrée 2',expo:'Expo 2030',saudi:'Pavillon saoudien',you:'Vous',where:'Où est votre groupe ?',met:'Rencontre avec Falwa',update:'47 m · il y a 12 s',firstTime:'74 m',secondTime:'49 m · il y a 30 s',thirdTime:'47 m · il y a 12 s',meeting:'Point de rencontre'}};
const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;');
const green='#004431',leaf='#1a9050',mint='#2aba95',pale='#e2f4ed';
function make(base,lang,width,height){const rows=[];const image=`data:image/png;base64,${readFileSync(root+base+'.png').toString('base64')}`;const defs=[];
// Restore only the text-area surface, then typeset the localized text in the existing box.
function text(x,y,w,h,value,{fill='white',color=green,size=24,bold=true,anchor='middle',baseline=y+h*.75,max=w-8}={}){rows.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`);const center=anchor==='end'?x+w-3:anchor==='start'?x+3:x+w/2;size = fittedSizes[`${base}/${lang}/${center}/${baseline}/${escape(value)}`] ?? size;rows.push(`<text x="${center}" y="${baseline}" font-size="${size}" font-weight="${bold?700:400}" fill="${color}" text-anchor="${anchor}"${max?` data-max-width="${max}"`:''}>${escape(value)}</text>`);}
function disk(cx,cy,r,value,fill,color='white',size=38,clipY=null){const id='disk-'+rows.length;if(clipY!==null)defs.push('<clipPath id="'+id+'"><rect x="'+(cx-r)+'" y="'+clipY+'" width="'+(r*2)+'" height="'+(r*2)+'"/></clipPath>');rows.push('<g'+(clipY!==null?' clip-path="url(#'+id+')"':'')+'><circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="'+fill+'"/><text x="'+cx+'" y="'+(cy+size*.32)+'" font-size="'+size+'" font-weight="700" fill="'+color+'" text-anchor="middle">'+value+'</text></g>');}
function pill(x,y,w,h,value,fill,color='white',size=22){rows.push('<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" rx="'+h/2+'" fill="'+fill+'"/>');const cx=x+w/2;size=fittedSizes[base+'/'+lang+'/'+cx+'/'+(y+h*.73)+'/'+escape(value)]??size;rows.push('<text x="'+cx+'" y="'+(y+h*.73)+'" font-size="'+size+'" font-weight="700" fill="'+color+'" text-anchor="middle" data-max-width="'+(w-12)+'">'+escape(value)+'</text>');}
function controls(cx,cy,r){const id='controls-'+rows.length;defs.push('<clipPath id="'+id+'"><circle cx="'+cx+'" cy="'+cy+'" r="'+r+'"/></clipPath>');rows.push('<use href="#original-art" clip-path="url(#'+id+')"/>');}
const c=copy[lang];
if(base==='meeting-art'){
text(417,112,208,43,c.meeting,{fill:green,color:'white',size:26});text(451,273,139,48,c.entrance1,{fill:leaf,color:'white',size:30});text(1040,226,120,46,c.entrance2,{fill:leaf,color:'white',size:30,max:0,anchor:'start'});text(717,742,271,54,c.expo,{fill:pale,size:40});
}else if(base==='map-art'){
text(293,84,102,45,c.plaza,{fill:'#f6fbf9',color:'#3f6e60',size:28});
// The left controls already occlude this example member; retain that crop.
pill(61,179,119,40,'Abdullah',green,'white',20);disk(123,129,32,'A','white',green,27);controls(76,132,44);controls(76,243,44);disk(110,316,12,'2','white',green,17);
disk(317,293,35,'A',mint,green,38);pill(254,341,124,41,'Abdulaziz',green,'white',23);
disk(716,425,35,'F',green,'white',38);pill(676,475,80,40,'Falwa',green,'white',23);
disk(167,631,35,'G',leaf,'white',38);pill(123,682,91,41,'Ghaida',green,'white',22);
text(99,495,100,42,c.entrance1,{fill:leaf,color:'white',size:25});text(558,456,104,39,c.entrance2,{fill:leaf,color:'white',size:25});
text(315,858,181,47,c.expo,{fill:pale,size:34});pill(529,845,75,39,c.you,'white',green,25);text(281,986,279,51,c.saudi,{fill:green,color:'white',size:36});
}else{
text(342,44,235,37,c.group,{size:25,anchor:'end'});text(472,84,110,31,c.members,{color:'#3f6e60',size:18,bold:false,anchor:'end'});text(155,62,110,35,c.signal,{fill:pale,size:18});
text(329,225,78,40,c.plaza,{fill:'#f6fbf9',color:'#3f6e60',size:26});pill(143,298,97,32,'Abdullah',green,'white',18);disk(202,258,25,'A','white',green,25);controls(159,197,34);controls(159,280,34);disk(184,340,12,'4','white',green,17);
text(547,223,146,41,'Ghaida',{size:29,anchor:'end'});text(486,268,210,34,c.update,{color:'#3f6e60',size:24,bold:false,anchor:'end'});disk(748,260,36,'G',leaf,'white',42);
disk(347,387,26,'A',mint,green,32);pill(298,425,97,34,'Abdulaziz',green,'white',19);
disk(657,489,26,'F',green,'white',32);pill(625,529,65,31,'Falwa',green,'white',17);disk(230,653,27,'G',leaf,'white',34);pill(196,691,71,33,'Ghaida',green,'white',17);
text(178,545,74,31,c.entrance1,{fill:leaf,color:'white',size:19});text(535,517,74,29,c.entrance2,{fill:leaf,color:'white',size:19});text(345,827,143,36,c.expo,{fill:pale,size:27});pill(514,816,57,33,c.you,'white',green,20);text(312,927,209,41,c.saudi,{fill:green,color:'white',size:28});
text(463,1050,218,48,c.where,{size:29,anchor:'end'});text(117,1080,225,56,c.met,{fill:mint,size:28});
disk(196,1174,29,'A','#24a685',green,28,1156);disk(412,1172,29,'F',green,'white',28,1156);disk(627,1172,29,'G',leaf,'white',28);
text(129,1217,113,31,'Abdulaziz',{size:22});text(385,1214,74,37,'Falwa',{size:22});text(588,1214,82,37,'Ghaida',{size:22});text(137,1251,99,32,c.firstTime,{color:leaf,size:21});text(278,1251,170,32,c.secondTime,{color:'#3f6e60',size:20,bold:false});text(491,1251,176,32,c.thirdTime,{color:leaf,size:20,bold:false});
}
return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" lang="${lang}"><title>DAL ${base} — ${lang.toUpperCase()}</title><defs><style>${fonts} text{font-family:Thmanyah,Arial,sans-serif}</style>${defs.join('')}</defs><image id="original-art" width="${width}" height="${height}" href="${image}"/>${rows.join('\n')}</svg>\n`;
}
for(const[base,width,height]of[['hero-phone',820,1360],['map-art',780,1076],['meeting-art',1160,880]])for(const lang of ['en','fr'])writeFileSync(root+base+'-'+lang+'.svg',make(base,lang,width,height));
