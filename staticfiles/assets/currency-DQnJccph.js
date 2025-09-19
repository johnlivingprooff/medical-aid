const t=new Intl.NumberFormat("en-MW",{style:"currency",currency:"MWK",maximumFractionDigits:0});function e(r){return r==null||isNaN(r)?"MWK 0":t.format(r)}export{e as f};
