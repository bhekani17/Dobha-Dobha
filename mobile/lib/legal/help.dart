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
      'Tap Message seller on a listing to send a purchase request. Arrange payment and collection directly with the seller. After the handoff, both of you can confirm completion in chat; this is not proof of payment and Dobha cannot verify off-app transactions.',
    ),
    HelpQuestion(
      'Does Dobha hold or protect my money?',
      'No. Dobha does not process payments or hold escrow funds. Do not treat a listing, offer or chat message as proof of payment.',
    ),
    HelpQuestion(
      'Can I ask for a lower price?',
      'Where available, tap Make an offer on a listing. If an offer is accepted, message the seller to discuss next steps; acceptance is not an order or payment.',
    ),
    HelpQuestion(
      'Can I ask the seller a question first?',
      'Yes. Open the listing and message the seller, or tap their name to see their profile and reviews.',
    ),
  ]),
  HelpTopic('Delivery', [
    HelpQuestion(
      'Are delivery services available?',
      'Delivery is not arranged through Dobha. Agree on collection or delivery details directly with the seller.',
    ),
    HelpQuestion(
      'How do I track an order?',
      'Historical order records may appear in Wallet & Orders. They are not proof of payment, dispatch or delivery.',
    ),
    HelpQuestion(
      'I have a problem with an order. What now?',
      'Contact support about a historical order record. Dobha cannot settle or refund payments through the app.',
    ),
  ]),
  HelpTopic('Problems with an order', [
    HelpQuestion(
      'Can Dobha refund or settle a problem?',
      'Dobha does not currently process payments, hold escrow funds or issue refunds or payouts. Contact support if you need help understanding a historical record.',
    ),
    HelpQuestion(
      'When is the seller paid?',
      'Dobha does not currently process seller payments or payouts.',
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
      'Dobha does not currently process seller payments or payouts.',
    ),
    HelpQuestion(
      'Can I complete a sale or arrange delivery here?',
      'You can message the seller about buying, but Dobha does not place orders, arrange dispatch or process payment.',
    ),
    HelpQuestion(
      'Can I go live?',
      'Yes. Open the Sell tab, tap a listing to pin it, name your stream and tap Go Live Now. Viewers can watch and chat, but cannot buy through Dobha checkout.',
    ),
  ]),
  HelpTopic('Wallet and payouts', [
    HelpQuestion(
      'How do I withdraw my money?',
      'Wallet withdrawals are unavailable. Do not treat displayed balances as money held by Dobha or as proof of funds owed.',
    ),
    HelpQuestion(
      'What do the displayed balances mean?',
      'Displayed wallet balances and transactions may be historical or test records. Dobha does not hold funds; these values are not proof of money owed or paid.',
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
      'Dobha checkout and payments are unavailable, and the app does not protect off-app transactions. Do not send money based on in-app balances, orders, offers or messages.',
    ),
    HelpQuestion(
      'How do I delete my account?',
      'Open Me, then Settings, then Delete account. Your profile and eligible personal data are removed; some historical records may be retained as required by law.',
    ),
  ]),
];
