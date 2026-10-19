/**
 * Dobha-Dobha Seed Script
 * Creates demo users, wallets, and marketplace items in DynamoDB
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import crypto from 'crypto';

const STAGE = 'dev';
const REGION = 'af-south-1';

const client = new DynamoDBClient({ region: REGION });
const db = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true, convertEmptyValues: true },
});

const TABLES = {
  users:    `${STAGE}-dobha-users`,
  sessions: `${STAGE}-dobha-sessions`,
  items:    `${STAGE}-dobha-items`,
  wallets:  `${STAGE}-dobha-wallets`,
  profiles: `${STAGE}-dobha-profiles`,
};

function uid(prefix) {
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return prefix ? `${prefix}_${rand}` : rand;
}

function now() { return Date.now(); }

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

async function put(table, item) {
  await db.send(new PutCommand({ TableName: table, Item: item }));
}

// ─── Seed Users ──────────────────────────────────────────────────────────────

const VENDORS = [
  {
    name: 'Nomsa Dlamini',
    handle: 'nomsa_threads',
    email: 'nomsa@dobha.dev',
    password: 'Demo1234',
    shopName: 'Nomsa Threads',
    stallLocation: 'Stall 4B, Rosebank Market',
    bio: 'Curated vintage & Afrocentric fashion. Every piece has a story.',
    role: 'vendor',
  },
  {
    name: 'Sipho Ndlovu',
    handle: 'sipho_tech',
    email: 'sipho@dobha.dev',
    password: 'Demo1234',
    shopName: 'Sipho Electronics',
    stallLocation: 'Mall of Africa, Tech Zone',
    bio: 'Pre-owned gadgets, tested and certified. Phones, laptops, accessories.',
    role: 'vendor',
  },
  {
    name: 'Ayanda Mokoena',
    handle: 'ayanda_home',
    email: 'ayanda@dobha.dev',
    password: 'Demo1234',
    shopName: 'Ayanda Home & Decor',
    stallLocation: 'Neighbourgoods Market, Braamfontein',
    bio: 'Handmade home decor, ceramics, and African art pieces.',
    role: 'vendor',
  },
  {
    name: 'Thabo Khumalo',
    handle: 'thabo_kicks',
    email: 'thabo@dobha.dev',
    password: 'Demo1234',
    shopName: 'Thabo Kicks',
    stallLocation: 'Eastgate Mall Kiosk 12',
    bio: 'Sneakers, streetwear, caps. Fresh and pre-loved kicks at fair prices.',
    role: 'vendor',
  },
];

const BUYERS = [
  {
    name: 'Lerato Sithole',
    handle: 'lerato_s',
    email: 'lerato@dobha.dev',
    password: 'Demo1234',
    role: 'buyer',
  },
  {
    name: 'Kagiso Mahlangu',
    handle: 'kagiso_m',
    email: 'kagiso@dobha.dev',
    password: 'Demo1234',
    role: 'buyer',
  },
];

// ─── Seed Items ───────────────────────────────────────────────────────────────

function makeItems(vendor) {
  const vendorItems = {
    nomsa_threads: [
      {
        title: 'Shweshwe Wrap Skirt',
        description: 'Beautiful traditional Shweshwe fabric wrap skirt in deep blue geometric print. Machine washable. Perfect for work or weekend.',
        price_cents: 42000,
        category: 'Fashion',
        condition: 'Pre-loved',
        size: 'M',
        brand: 'Handmade',
        tags: ['shweshwe', 'african', 'skirt', 'traditional'],
      },
      {
        title: 'Ankara Print Blazer',
        description: 'Statement Ankara blazer in bold orange & black wax print. Unlined, lightweight. Size 36/S.',
        price_cents: 75000,
        category: 'Fashion',
        condition: 'Pre-loved',
        size: 'S',
        brand: 'Handmade',
        tags: ['ankara', 'blazer', 'wax-print', 'afrocentric'],
      },
      {
        title: 'Vintage Levi\'s 501 Jeans',
        description: 'Classic 501 straight cut, mid-blue wash. Some natural fading. Waist 30, Leg 32. No tears.',
        price_cents: 35000,
        category: 'Fashion',
        condition: 'Pre-loved',
        size: '30/32',
        brand: "Levi's",
        tags: ['levis', 'denim', 'vintage', 'jeans'],
      },
      {
        title: 'Beaded Zulu Necklace Set',
        description: 'Handcrafted set of 3 Zulu beaded necklaces in red, white & black. Traditional patterns. Great gift.',
        price_cents: 28000,
        category: 'Accessories',
        condition: 'New',
        size: 'One Size',
        brand: 'Handmade',
        tags: ['zulu', 'beaded', 'jewellery', 'traditional', 'necklace'],
      },
      {
        title: 'Dashiki Print Shirt',
        description: 'Men\'s dashiki shirt in golden yellow. Loose fit, breathable fabric. Great condition. Size L.',
        price_cents: 32000,
        category: 'Fashion',
        condition: 'Pre-loved',
        size: 'L',
        brand: 'Handmade',
        tags: ['dashiki', 'menswear', 'african'],
      },
    ],
    sipho_tech: [
      {
        title: 'Samsung Galaxy S22 128GB',
        description: 'Excellent condition Galaxy S22 in Phantom Black. 128GB storage, no cracks, battery health 91%. Comes with original charger.',
        price_cents: 799900,
        category: 'Electronics',
        condition: 'Pre-loved',
        size: 'One Size',
        brand: 'Samsung',
        tags: ['samsung', 'android', 'smartphone', 's22'],
      },
      {
        title: 'Apple AirPods Pro (2nd Gen)',
        description: 'AirPods Pro 2 with ANC and Transparency mode. Minor ear tip wear. Case charges wirelessly. All functions perfect.',
        price_cents: 249900,
        category: 'Electronics',
        condition: 'Pre-loved',
        size: 'One Size',
        brand: 'Apple',
        tags: ['apple', 'airpods', 'earbuds', 'wireless'],
      },
      {
        title: 'Lenovo ThinkPad X1 Carbon',
        description: 'ThinkPad X1 Carbon Gen 9. i7-1165G7, 16GB RAM, 512GB SSD. Windows 11 Pro. Light scuffs on lid. Perfect for work.',
        price_cents: 1299900,
        category: 'Electronics',
        condition: 'Pre-loved',
        size: 'One Size',
        brand: 'Lenovo',
        tags: ['laptop', 'thinkpad', 'lenovo', 'business'],
      },
      {
        title: 'GoPro Hero 11 Black',
        description: 'GoPro Hero 11 with 2 batteries, 64GB card, and chest mount. Used for one trip. 5.3K video. All accessories included.',
        price_cents: 599900,
        category: 'Electronics',
        condition: 'Pre-loved',
        size: 'One Size',
        brand: 'GoPro',
        tags: ['gopro', 'camera', 'action-cam', 'video'],
      },
      {
        title: 'Anker PowerBank 26800mAh',
        description: 'Anker PowerCore 26800 portable charger. 3 USB-A ports. Can charge a phone 6x over. Barely used.',
        price_cents: 89900,
        category: 'Electronics',
        condition: 'Pre-loved',
        size: 'One Size',
        brand: 'Anker',
        tags: ['powerbank', 'charger', 'anker', 'portable'],
      },
    ],
    ayanda_home: [
      {
        title: 'Hand-Thrown Ceramic Mug Set (4)',
        description: 'Set of 4 hand-thrown stoneware mugs in earthy terracotta glaze. Microwave & dishwasher safe. Each piece is unique.',
        price_cents: 58000,
        category: 'Home & Garden',
        condition: 'New',
        size: 'One Size',
        brand: 'Handmade',
        tags: ['ceramics', 'mugs', 'pottery', 'handmade', 'kitchen'],
      },
      {
        title: 'Woven Ndebele Wall Basket',
        description: 'Large hand-woven Ndebele pattern wall basket in natural sisal & cotton. 45cm diameter. Makes a bold statement.',
        price_cents: 95000,
        category: 'Home & Garden',
        condition: 'New',
        size: 'Large',
        brand: 'Handmade',
        tags: ['basket', 'wall-decor', 'ndebele', 'woven', 'african'],
      },
      {
        title: 'African Violet Oil Diffuser',
        description: 'Carved mopane wood oil diffuser with 3 essential oil blends (rooibos, buchu, marula). Handcrafted in Limpopo.',
        price_cents: 42000,
        category: 'Home & Garden',
        condition: 'New',
        size: 'One Size',
        brand: 'Handmade',
        tags: ['diffuser', 'aromatherapy', 'wood', 'wellness'],
      },
      {
        title: 'Batik Table Runner 1.8m',
        description: 'Hand-dyed batik cotton table runner in indigo blue and gold. 1.8m × 35cm. Perfect for dining tables or dressers.',
        price_cents: 38000,
        category: 'Home & Garden',
        condition: 'New',
        size: 'One Size',
        brand: 'Handmade',
        tags: ['batik', 'table-runner', 'linen', 'decor'],
      },
    ],
    thabo_kicks: [
      {
        title: 'Nike Air Force 1 Low White (Size 10)',
        description: 'Classic AF1 low in triple white. Worn twice, clean soles. No box. UK size 10 / EU 44.5.',
        price_cents: 189900,
        category: 'Footwear',
        condition: 'Pre-loved',
        size: 'UK 10',
        brand: 'Nike',
        tags: ['nike', 'airforce1', 'sneakers', 'white'],
      },
      {
        title: 'Adidas Ultraboost 22 Black UK9',
        description: 'Adidas Ultraboost 22 in core black. Light use, midsole still bouncy. UK 9. With original box.',
        price_cents: 249900,
        category: 'Footwear',
        condition: 'Pre-loved',
        size: 'UK 9',
        brand: 'Adidas',
        tags: ['adidas', 'ultraboost', 'running', 'sneakers'],
      },
      {
        title: 'Jordan 1 Retro High OG "Bred Toe"',
        description: 'Jordan 1 Retro High in Black/Red/White. Size UK 8. Stored in box, minimal wear. Deadstock condition.',
        price_cents: 459900,
        category: 'Footwear',
        condition: 'Pre-loved',
        size: 'UK 8',
        brand: 'Jordan',
        tags: ['jordan', 'aj1', 'bred', 'sneakers', 'hype'],
      },
      {
        title: 'New Era 59FIFTY Kaizer Chiefs Cap',
        description: 'Official Kaizer Chiefs New Era fitted cap. Size 7 3/8. Worn once to a match. Perfect condition.',
        price_cents: 55000,
        category: 'Accessories',
        condition: 'Pre-loved',
        size: '7 3/8',
        brand: 'New Era',
        tags: ['newera', 'kaizer-chiefs', 'cap', 'football'],
      },
      {
        title: 'Puma Suede Classic "Peacoat" UK8',
        description: 'Puma Suede Classic in Navy/White. Timeless casual shoe. UK 8. Some creasing on toe box. No box.',
        price_cents: 89900,
        category: 'Footwear',
        condition: 'Pre-loved',
        size: 'UK 8',
        brand: 'Puma',
        tags: ['puma', 'suede', 'casual', 'sneakers'],
      },
    ],
  };

  return vendorItems[vendor.handle] || [];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const allUsers = [...VENDORS, ...BUYERS];
  const createdVendors = [];

  console.log('\n🌱 Seeding Dobha-Dobha marketplace...\n');

  // Create users
  for (const u of allUsers) {
    const userId = uid('usr');
    const { hash, salt } = hashPassword(u.password);
    const ts = now();

    const user = {
      id: userId,
      email: u.email,
      handle: u.handle,
      name: u.name,
      password_hash: hash,
      password_salt: salt,
      role: u.role,
      shop_name: u.shopName || '',
      stall_location: u.stallLocation || '',
      bio: u.bio || '',
      created_at: ts,
      updated_at: ts,
    };

    await put(TABLES.users, user);

    // Wallet
    await put(TABLES.wallets, {
      user_id: userId,
      available_cents: u.role === 'vendor' ? Math.floor(Math.random() * 50000) + 5000 : 0,
      locked_cents: 0,
      pending_cents: 0,
      updated_at: ts,
    });

    // Profile
    await put(TABLES.profiles, {
      user_id: userId,
      followers_count: u.role === 'vendor' ? Math.floor(Math.random() * 200) + 10 : 0,
      following_count: Math.floor(Math.random() * 50),
      items_count: 0,
      reviews_count: 0,
      rating_sum: 0,
      updated_at: ts,
    });

    if (u.role === 'vendor') {
      createdVendors.push({ ...user, password: u.password });
    }

    console.log(`  ✅ User: ${u.name} <${u.email}>  (${u.role})`);
  }

  // Create items
  console.log('\n📦 Seeding items...\n');
  let totalItems = 0;

  for (const vendor of createdVendors) {
    const vendorDef = VENDORS.find(v => v.handle === vendor.handle);
    const items = makeItems(vendorDef);

    for (const itemDef of items) {
      const itemId = uid('itm');
      const ts = now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000); // random within last week

      await put(TABLES.items, {
        id: itemId,
        seller_id: vendor.id,
        seller_name: vendor.name,
        seller_handle: vendor.handle,
        shop_name: vendor.shop_name,
        stall_location: vendor.stall_location,
        title: itemDef.title,
        description: itemDef.description,
        price_cents: itemDef.price_cents,
        category: itemDef.category,
        condition: itemDef.condition,
        size: itemDef.size,
        brand: itemDef.brand,
        tags: itemDef.tags,
        status: 'available',
        quantity: 1,
        photos: [],
        photo_keys: [],
        likes_count: Math.floor(Math.random() * 30),
        is_promoted: false,
        created_at: ts,
        updated_at: ts,
      });

      totalItems++;
      console.log(`  📦 ${itemDef.title} — R${(itemDef.price_cents / 100).toFixed(2)} (${vendor.handle})`);
    }
  }

  console.log(`\n✨ Done! Created ${allUsers.length} users and ${totalItems} items.\n`);
  console.log('Test accounts (password: Demo1234):');
  for (const v of createdVendors) {
    console.log(`  🏪 ${v.email}  [${v.shop_name || v.handle}]`);
  }
  console.log(`  👤 lerato@dobha.dev`);
  console.log(`  👤 kagiso@dobha.dev`);
  console.log('');
}

main().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
