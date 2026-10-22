/// Answers for the Help screen, grouped by topic and current application behavior.
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
      'Browse listings and add finds to your bag. Go to checkout to place your order. You can pay with card or wallet balance.',
    ),
    HelpQuestion(
      'Does Dobha hold or protect my money?',
      'Yes. Dobha uses escrow to protect your payment. Funds are held until you confirm you received the item in good condition.',
    ),
    HelpQuestion(
      'Can I ask for a lower price?',
      'Yes. Tap Make an offer on a listing. The seller can accept, decline or send a counter offer. Once accepted, complete the purchase through checkout.',
    ),
    HelpQuestion(
      'Can I ask the seller a question first?',
      'Yes. Open the listing and message the seller, or tap their name to see their profile and reviews.',
    ),
  ]),
  HelpTopic('Delivery', [
    HelpQuestion(
      'Are delivery services available?',
      'Yes. You can choose seller-arranged courier, buyer pickup, or courier service at checkout.',
    ),
    HelpQuestion(
      'How do I track an order?',
      'Track your order status in the Wallet & Orders screen. The seller will provide tracking information when they dispatch.',
    ),
    HelpQuestion(
      'I have a problem with an order. What now?',
      'You can open a dispute if there is an issue with your order. Dobha support will help mediate.',
    ),
  ]),
  HelpTopic('Problems with an order', [
    HelpQuestion(
      'Can Dobha refund or settle a problem?',
      'Yes. If there is a dispute, Dobha support will review and may release funds back to the buyer or pay the seller depending on the outcome.',
    ),
    HelpQuestion(
      'When is the seller paid?',
      'The seller is paid after you confirm you received the item in good condition, or after the dispute resolution period ends.',
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
      'You get paid after the buyer confirms receipt or after the dispute resolution period ends. Funds are held in escrow until then.',
    ),
    HelpQuestion(
      'Can I complete a sale or arrange delivery here?',
      'Yes. When you receive an order, dispatch the item and provide tracking. Once the buyer confirms, you receive payment.',
    ),
    HelpQuestion(
      'Can I go live?',
      'Yes. Open the Sell tab, tap a listing to pin it, name your stream and tap Go Live Now. Viewers can watch and chat, and buy directly from your stream.',
    ),
  ]),
  HelpTopic('Wallet and payouts', [
    HelpQuestion(
      'How do I withdraw my money?',
      'Go to Wallet & Orders and tap Withdraw. Enter your bank details to withdraw available funds.',
    ),
    HelpQuestion(
      'What do the displayed balances mean?',
      'Available balance can be withdrawn. On hold funds are in escrow for active orders. Pending funds are from sales awaiting confirmation.',
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
      'Always complete transactions through Dobha checkout. Do not send money directly to sellers outside the app. Dobha escrow protects your payment.',
    ),
    HelpQuestion(
      'How do I delete my account?',
      'Open Me, then Settings, then Delete account. Your profile and eligible personal data are removed; some historical records may be retained as required by law.',
    ),
  ]),
];
