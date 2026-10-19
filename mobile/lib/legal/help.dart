/// Answers for the Help screen, grouped by topic. Keep them in step with how the app and server actually work
/// (delivery prices and the 5% fee live in server/src/orders.js).
library;

class HelpQuestion {
  final String question;
  final String answer;
  const HelpQuestion(this.question, this.answer);
}

class HelpTopic {
  final String title;
  final List<HelpQuestion> questions;
  const HelpTopic(this.title, this.questions);
}

const helpTopics = [
  HelpTopic('Buying', [
    HelpQuestion(
      'How do I buy a piece?',
      'Tap a piece on Home or Explore, then tap Buy. Choose how you want it delivered and how you want to pay, and check the total before you pay. You can also add several pieces to your cart and check out together.',
    ),
    HelpQuestion(
      'Is my money safe?',
      'Yes. When you pay, Dobha Dobha holds the money. The seller is only paid after you tell us you received the piece and it is what you expected. If something is wrong, report a problem from the order before you confirm and the money stays on hold.',
    ),
    HelpQuestion(
      'Can I ask for a lower price?',
      'Yes. Tap Make an offer on a listing. The seller can accept, decline or send a counter offer. If an offer is accepted, you have 48 hours to buy the piece at that price.',
    ),
    HelpQuestion(
      'Can I ask the seller a question first?',
      'Yes. Open the listing and message the seller, or tap their name to see their profile and reviews. Keep chats and payments inside Dobha Dobha so you stay protected.',
    ),
  ]),
  HelpTopic('Delivery', [
    HelpQuestion(
      'What delivery options are there?',
      'PUDO Locker-to-Locker (R 50), Courier Guy Door-to-Door (R 65), or free collection at the Downtown Joburg Safe Hub. Delivery is charged per piece because each seller sends their own.',
    ),
    HelpQuestion(
      'How do I track my order?',
      'Open the Orders tab. When the seller sends your piece they add the courier tracking number, and you get a notification. For Safe Hub orders you are told when it is ready to collect.',
    ),
    HelpQuestion(
      'The seller has not sent my piece. What now?',
      'Sellers should send within 3 business days. Message the seller first. If you hear nothing, use Contact support and tell us the order, and we will follow up. Your money stays on hold the whole time.',
    ),
  ]),
  HelpTopic('Problems with an order', [
    HelpQuestion(
      'My piece is not what was shown. What do I do?',
      'Do not confirm the order. Open it in the Orders tab and tap Report a problem. The money stays on hold while Dobha support looks into it with you and the seller, then we refund you or pay the seller depending on what happened.',
    ),
    HelpQuestion(
      'I confirmed by mistake.',
      'Once you confirm, the seller is paid, so it cannot be undone in the app. Use Contact support straight away and tell us the order, and we will see what we can do with the seller.',
    ),
    HelpQuestion(
      'How long does support take?',
      'We aim to answer within 2 business days. You get a notification when we reply, and you can see your questions and our answers under Help, then Your questions.',
    ),
  ]),
  HelpTopic('Selling', [
    HelpQuestion(
      'How do I start selling?',
      'Open Me and tap Start Selling. Add your shop name and stall location, then list pieces from the Sell tab with New Listing, using clear photos, the right size and condition, and any flaws.',
    ),
    HelpQuestion(
      'When do I get paid?',
      'As soon as the buyer confirms they received the piece. The price minus the 5% Dobha fee goes into your Dobha wallet. Delivery fees are not part of your payout.',
    ),
    HelpQuestion(
      'How do I send a sold piece?',
      'Send it within 3 business days with the delivery option the buyer chose, then open the order and tap the button to mark it as sent, adding the tracking number from your receipt. Safe Hub orders do not need a tracking number.',
    ),
    HelpQuestion(
      'Can I go live?',
      'Yes. Open the Sell tab, tap a listing to pin it, name your stream and tap Go Live Now. Viewers can buy the pinned piece while you show it.',
    ),
  ]),
  HelpTopic('Wallet and payouts', [
    HelpQuestion(
      'How do I withdraw my money?',
      'Open the Orders tab and tap Withdraw. Enter a South African bank account. Only money that is available can be withdrawn; money still held for orders becomes available once those orders are done.',
    ),
    HelpQuestion(
      'What are the different balances?',
      'You can spend or withdraw: money that is yours now. On hold for your orders: money you paid for pieces still on their way. Coming to you from sales: money from your sales, paid to you once buyers confirm.',
    ),
  ]),
  HelpTopic('Account and safety', [
    HelpQuestion(
      'I forgot my password.',
      'On the log in screen, tap Forgot password. We email you a 6-digit code to set a new one. If you signed up with Google, use Continue with Google instead.',
    ),
    HelpQuestion(
      'How do I report a listing or a person?',
      'Open the listing menu and tap Report listing. For a person, a chat or anything else, use Contact support and pick Safety or a scam. We review every report.',
    ),
    HelpQuestion(
      'How do I stay safe?',
      'Keep chats and payments inside Dobha Dobha. Never pay a seller directly or share your banking PIN or passwords. Be careful of anyone who asks you to move a deal off the app.',
    ),
    HelpQuestion(
      'How do I delete my account?',
      'Open Me, then Settings, then Delete account. Finish any orders and withdraw your wallet first. Your profile, listings that never sold, likes and saves are removed; order records are kept as the law requires.',
    ),
  ]),
];
