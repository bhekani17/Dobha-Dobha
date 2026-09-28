const { prisma } = require('./prisma');

async function seed() {
  console.log('🌱 Starting database seeding for DOBHA DOBHA...');

  // 1. Get or create primary seller
  let seller = await prisma.user.findFirst();
  if (!seller) {
    seller = await prisma.user.create({
      data: {
        email: 'trader@dobhadobha.co.za',
        passwordHash: '$2a$10$SpmA6o88aqFvK5T9RGB9TOJvi70wLoZ17xW27d7nD1ZKI.T18.02m',
        name: 'Sipho Zulu',
        role: 'both',
        phone: '078 123 4567',
        location: 'Joburg CBD (Bree Taxi Rank)',
        bio: 'Grade A street thrifter at Bree Rank Platform 3. Direct bale drops daily at 14:00.',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
        verificationStatus: 'verified'
      }
    });
  } else {
    // Update existing user with nice avatar and verified status
    seller = await prisma.user.update({
      where: { id: seller.id },
      data: {
        avatarUrl: seller.avatarUrl || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
        verificationStatus: 'verified'
      }
    });
  }

  console.log(`✅ Using seller: ${seller.name} (${seller.id})`);

  // 2. Clear old test items with broken images
  await prisma.itemImage.deleteMany({});
  await prisma.escrowOrder.deleteMany({});
  await prisma.item.deleteMany({});

  // 3. Insert verified authentic street thrift pieces
  const itemsData = [
    {
      title: "Vintage Levi's 501 Big E Denim Jeans",
      description: "Authentic Made in USA vintage Levi's 501s straight cut. Medium stone wash with genuine street fades. Inspected at Bree Taxi Rank.",
      category: "denim",
      condition: "Grade A Street Thrift",
      price: 350.00,
      originalPrice: 1200.00,
      location: "Bree Taxi Rank Platform 3, Joburg CBD",
      status: "active",
      isVerified: true,
      imageUrl: "https://images.unsplash.com/photo-1542272604-780c96856592?auto=format&fit=crop&w=800&q=80"
    },
    {
      title: "Carhartt Detroit Workwear Duck Jacket",
      description: "Heavy canvas blanket-lined Carhartt work jacket. Dark brown wash with corduroy collar. Clean brass zipper, no tears.",
      category: "outerwear",
      condition: "Like New",
      price: 650.00,
      originalPrice: 2400.00,
      location: "Park Station Metro Concourse, Joburg",
      status: "active",
      isVerified: true,
      imageUrl: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=80"
    },
    {
      title: "90s Nike Spellout Colorblock Windbreaker",
      description: "Rare 90s vintage Nike hooded windbreaker in green, navy & white colorway. Lightweight nylon shell with embroidered front swoosh.",
      category: "streetwear",
      condition: "Grade A Thrift",
      price: 420.00,
      originalPrice: 1600.00,
      location: "Braamfontein Safe Hub, Johannesburg",
      status: "active",
      isVerified: true,
      imageUrl: "https://images.unsplash.com/photo-1578587018452-892bacefd3f2?auto=format&fit=crop&w=800&q=80"
    },
    {
      title: "Dickies 874 Original Fit Work Pants",
      description: "Original heavyweight twill Dickies trousers in charcoal black. Pressed crease, stain resistant, durable street skate staple.",
      category: "pants",
      condition: "Like New",
      price: 280.00,
      originalPrice: 850.00,
      location: "Bree Taxi Rank, Joburg CBD",
      status: "active",
      isVerified: true,
      imageUrl: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=800&q=80"
    },
    {
      title: "Vintage Polo Ralph Lauren Cable-Knit Sweater",
      description: "Classic 100% cotton cable-knit crewneck in cream with navy embroidered pony. Soft handle, zero bobbling, perfectly preserved.",
      category: "vintage",
      condition: "Grade A Thrift",
      price: 380.00,
      originalPrice: 2100.00,
      location: "Maboneng Safe Hub, Johannesburg",
      status: "active",
      isVerified: true,
      imageUrl: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=800&q=80"
    },
    {
      title: "Dr. Martens 1460 Smooth Leather 8-Eye Boots",
      description: "Original 8-eye Dr. Martens boots in cherry red smooth leather. Air-cushioned bouncing soles with classic yellow welt stitching.",
      category: "footwear",
      condition: "Good Condition",
      price: 890.00,
      originalPrice: 2800.00,
      location: "Joburg CBD Safe Trade Hub",
      status: "active",
      isVerified: true,
      imageUrl: "https://images.unsplash.com/photo-1520639888713-7851133b1ed0?auto=format&fit=crop&w=800&q=80"
    },
    {
      title: "Starter Chicago Bulls Satin Bomber Jacket",
      description: "Iconic 90s NBA Starter jacket with Bulls embroidered script and sleeve logo. Quilted lining, snap closures, collector condition.",
      category: "outerwear",
      condition: "Collector Grade",
      price: 750.00,
      originalPrice: 3200.00,
      location: "Bree Taxi Rank Platform 3, Joburg CBD",
      status: "active",
      isVerified: true,
      imageUrl: "https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=800&q=80"
    },
    {
      title: "Stüssy World Tour Heavyweight Graphic Tee",
      description: "Original Stüssy streetwear tee in faded black. Featuring New York, Los Angeles, Tokyo, London, Paris graphic print.",
      category: "streetwear",
      condition: "Grade A Thrift",
      price: 220.00,
      originalPrice: 750.00,
      location: "Newtown Junction Hub, Joburg",
      status: "active",
      isVerified: true,
      imageUrl: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80"
    },
    {
      title: "Vintage The North Face Nuptse 700 Puffer",
      description: "Authentic 700-fill down insulation puffer jacket in evergreen & black. Stowable hood, ripstop nylon shell, ultra warm.",
      category: "outerwear",
      condition: "Like New",
      price: 1100.00,
      originalPrice: 4500.00,
      location: "Braamfontein Safe Hub, Johannesburg",
      status: "active",
      isVerified: true,
      imageUrl: "https://images.unsplash.com/photo-1548883354-7622d03aca27?auto=format&fit=crop&w=800&q=80"
    },
    {
      title: "Timberland 6-Inch Premium Waterproof Nubuck Boots",
      description: "Iconic wheat nubuck leather boots with padded collar and lug rubber outsoles. Clean condition, sanitized and conditioned.",
      category: "footwear",
      condition: "Good Condition",
      price: 950.00,
      originalPrice: 3400.00,
      location: "Bree Taxi Rank Concourse, Joburg CBD",
      status: "active",
      isVerified: true,
      imageUrl: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80"
    }
  ];

  for (const it of itemsData) {
    const item = await prisma.item.create({
      data: {
        sellerId: seller.id,
        title: it.title,
        description: it.description,
        category: it.category,
        condition: it.condition,
        price: it.price,
        originalPrice: it.originalPrice,
        location: it.location,
        status: it.status,
        isVerified: it.isVerified
      }
    });

    await prisma.itemImage.create({
      data: {
        itemId: item.id,
        imageUrl: it.imageUrl,
        isPrimary: true
      }
    });
  }

  console.log(`✅ Seeded ${itemsData.length} verified street thrift pieces.`);

  // 4. Ensure stream registry is clean so only authentic user-created live streams appear
  await prisma.streamChat.deleteMany({});
  await prisma.stream.deleteMany({});

  console.log('✅ Live stream registry reset for 100% authentic broadcasts.');
  console.log('🎉 Seeding completed successfully!');
}

seed()
  .catch((err) => {
    console.error('Seeding error:', err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
