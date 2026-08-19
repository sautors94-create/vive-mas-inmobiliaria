// Corre esto UNA SOLA VEZ después de desplegar el cambio del campo slug,
// para que las propiedades que ya existían en la base de datos también
// tengan un slug (si no, sus links /p/:slug no funcionan hasta que alguien
// las edite y se vuelvan a guardar).
//
// Uso: node backfill-slugs.js
require('dotenv').config();
const mongoose = require('mongoose');
const Property = require('./src/models/Property');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const sinSlug = await Property.find({ slug: { $in: [null, undefined] } });
  console.log(`Propiedades sin slug encontradas: ${sinSlug.length}`);

  let ok = 0;
  for (const prop of sinSlug) {
    try {
      await prop.save(); // dispara el pre('save') que genera el slug
      ok++;
    } catch (e) {
      console.error(`Error en propiedad ${prop._id}:`, e.message);
    }
  }
  console.log(`Listo: ${ok}/${sinSlug.length} propiedades actualizadas con slug.`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
