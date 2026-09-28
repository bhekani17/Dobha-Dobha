/**
 * DOBHA DOBHA — Terminal Database Inspector
 * Displays live PostgreSQL RDS records in clean formatted tables
 */
const { prisma } = require('./prisma');

async function viewDatabase() {
  console.log('\n========================================================');
  console.log('       DOBHA DOBHA — LIVE POSTGRESQL RDS DATABASE        ');
  console.log('========================================================\n');

  try {
    // 1. Users
    const users = await prisma.user.findMany({
      include: { wallet: true },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`👤 REGISTERED USERS (${users.length}):`);
    if (users.length === 0) {
      console.log('   (No users registered yet)\n');
    } else {
      console.table(
        users.map(u => ({
          ID: u.id.slice(0, 8) + '...',
          Name: u.name,
          Email: u.email,
          Role: u.role,
          Phone: u.phone || 'N/A',
          Location: u.location,
          Wallet: `R${Number(u.wallet?.balance || 0).toFixed(2)}`,
          Joined: u.createdAt.toISOString().slice(0, 10)
        }))
      );
      console.log('');
    }

    // 2. Items
    const items = await prisma.item.findMany({
      include: { seller: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`🏷️  MARKETPLACE ITEMS (${items.length}):`);
    if (items.length === 0) {
      console.log('   (No items listed yet)\n');
    } else {
      console.table(
        items.map(i => ({
          ID: i.id.slice(0, 8) + '...',
          Title: i.title,
          Price: `R${Number(i.price).toFixed(2)}`,
          Category: i.category,
          Seller: i.seller?.name || 'N/A',
          Location: i.location,
          Barter: i.allowBarter ? 'Yes' : 'No'
        }))
      );
      console.log('');
    }

    // 3. Escrow Orders
    const orders = await prisma.escrowOrder.findMany({
      include: {
        seller: { select: { name: true } },
        buyer: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`🛡️  ESCROW ORDERS (${orders.length}):`);
    if (orders.length === 0) {
      console.log('   (No escrow orders placed yet)\n');
    } else {
      console.table(
        orders.map(o => ({
          ID: o.id.slice(0, 8) + '...',
          Item: o.itemTitle,
          Price: `R${Number(o.itemPrice).toFixed(2)}`,
          Buyer: o.buyer?.name || 'N/A',
          Seller: o.seller?.name || 'N/A',
          Token: o.pickupToken,
          Status: o.status
        }))
      );
      console.log('');
    }
  } catch (err) {
    console.error('Error querying database:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

viewDatabase();
