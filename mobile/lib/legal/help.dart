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
      'Browse listings and add finds to your bag, but checkout is not available yet. Dobha does not currently process payments, create paid orders, or hold funds.',
    ),
    HelpQuestion(
      'Does Dobha hold or protect my money?',
      'No. Payments and escrow are not available. Do not send money or banking details to a seller based on a listing, order record, or wallet balance in the app.',
    ),
    HelpQuestion(
      'Can I ask for a lower price?',
      'Yes. Tap Make an offer on a listing. The seller can accept, decline or send a counter offer. Accepting an offer does not place an order; checkout is unavailable.',
    ),
    HelpQuestion(
      'Can I ask the seller a question first?',
      'Yes. Open the listing and message the seller, or tap their name to see their profile and reviews. Dobha does not currently process payments or protect off-platform transactions.',
    ),
  ]),
  HelpTopic('Delivery', [
    HelpQuestion(
      'Are delivery services available?',
      'Delivery partners are not integrated. Any delivery options or tracking shown on historical order records are not verified by Dobha.',
    ),
    HelpQuestion(
      'How do I track an order?',
      'Paid checkout is unavailable. Older order records may show demo or historical delivery statuses that are not verified by a shipping provider.',
    ),
    HelpQuestion(
      'I have a problem with an order record. What now?',
      'Dobha does not hold funds or settle orders. Use Contact support to ask about the record; do not treat its status as proof of payment or delivery.',
    ),
  ]),
  HelpTopic('Problems with an order', [
    HelpQuestion(
      'Can Dobha refund or settle a problem?',
      'No. Payments, refunds, and escrow settlement are unavailable. Contact support for questions about a historical record; support cannot move or refund money through the app.',
    ),
    HelpQuestion(
      'An old order says it was confirmed. Was the seller paid?',
      'Not necessarily. Historical/demo statuses do not verify that a real payment or payout took place. Contact support if you need help understanding a record.',
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
      'Payouts and paid orders are not available. A displayed wallet balance or order status is not proof that Dobha owes or holds funds.',
    ),
    HelpQuestion(
      'Can I complete a sale or arrange delivery here?',
      'Listings and live video are available, but checkout and delivery services are not integrated. Do not treat a listing or accepted offer as a completed sale.',
    ),
    HelpQuestion(
      'Can I go live?',
      'Yes. Open the Sell tab, tap a listing to pin it, name your stream and tap Go Live Now. Viewers can watch and chat, but cannot buy through an in-app payment.',
    ),
  ]),
  HelpTopic('Wallet and payouts', [
    HelpQuestion(
      'How do I withdraw my money?',
      'Real withdrawals are unavailable. The wallet can record a simulated withdrawal for demo purposes only; it does not send money or ask for bank details. Wallet balances are not spendable funds held by Dobha.',
    ),
    HelpQuestion(
      'What do the displayed balances mean?',
      'They may reflect historical or demo records only. Dobha does not currently accept deposits, hold escrow funds, or make payouts.',
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
      'Dobha does not process payments or protect off-platform transactions. Do not send money, share banking PINs or passwords, or rely on app order statuses as proof of a transaction.',
    ),
    HelpQuestion(
      'How do I delete my account?',
      'Open Me, then Settings, then Delete account. Your profile and eligible personal data are removed; some historical records may be retained as required by law.',
    ),
  ]),
];
