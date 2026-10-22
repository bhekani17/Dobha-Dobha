/// Dobha Dobha's Terms and Conditions, shown in the app and accepted when registering.
///
/// Bump [termsVersion] whenever the text changes in a way users should agree to again;
/// the server records which version each account accepted. After changing the text, run
/// `python tool/build_legal_pages.py` to update the public web page (web/terms.html).
library;

const termsVersion = '2026-10-22.1';
const termsUpdated = '22 October 2026';

class TermsSection {
  final String title;
  final List<String> paragraphs;
  const TermsSection(this.title, this.paragraphs);
}

const termsSections = [
  TermsSection('1. Agreeing to these terms', [
    'These terms are an agreement between you and Dobha Dobha. By creating an account or using the app, you agree to them. If you do not agree, please do not use Dobha Dobha.',
    'Dobha Dobha is a marketplace. We connect people buying and selling goods across categories such as clothing, electronics, home goods, books, sports gear and collectibles. Unless we say otherwise, the seller of an item is the person or shop that listed it, not Dobha Dobha.',
  ]),
  TermsSection('2. Your account', [
    'You must be 18 or older, or have a parent or guardian\'s permission, to use Dobha Dobha.',
    'Give us true details when you sign up, keep your password private, and tell us straight away if you think someone else is using your account. You are responsible for what happens on your account.',
    'You may have one personal account. We may suspend or close accounts that break these terms.',
  ]),
  TermsSection('3. Buying', [
    'Items may be new or pre-owned. Look carefully at the photos, details, condition and description, and ask the seller in chat if anything is unclear.',
    'A purchase request opens a message draft to the seller. It does not place an order, reserve an item, or process payment through Dobha. Agree on payment and collection directly with the seller and use care. After the direct handoff, both parties may report completion in chat; Dobha does not verify payment or the transaction.',
  ]),
  TermsSection('4. Selling', [
    'You can sell once you add your shop name and stall location. You must own what you list and have the right to sell it.',
    'Listings must be honest: use real photos, accurate details and condition, and describe any flaws. The quantity you list must be what you actually have.',
    'Dobha does not process orders or seller payouts. Both parties can report a direct sale as complete in chat, which marks the listing sold; this report is not verified by Dobha.',
  ]),
  TermsSection('5. Offers', [
    'Buyers can make offers and sellers can accept, decline or counter where these features are available. An accepted offer is not payment or a completed order; contact the seller to discuss next steps.',
  ]),
  TermsSection('6. Payments, payouts and problems', [
    'Dobha does not currently process payments, hold escrow funds, accept wallet deposits, make withdrawals or pay sellers. Historical order, wallet and transaction records may be test or legacy data and are not proof that money was paid, held, refunded or is owed.',
    'Do not provide card or bank details or send money based on an in-app balance, order, offer or message. Contact support if you need help understanding a historical record.',
    'Nothing in these terms takes away your rights under the Consumer Protection Act or other South African law.',
  ]),
  TermsSection('7. Things you may not sell', [
    'Counterfeit or fake branded goods, stolen goods, weapons, drugs, alcohol, tobacco and vaping products, adult content, used underwear or swimwear that has not been washed, items that are recalled or unsafe, and anything else that is illegal to sell in South Africa.',
  ]),
  TermsSection('8. Live streams, chat and comments', [
    'Be respectful. Harassment, threats, hate speech, sexual content, spam and scams are not allowed in live streams, chats, comments or listings.',
    'Do not share other people\'s personal information. Dobha does not process payments or protect off-app deals. The website can watch live streams hosted from the mobile app; it cannot host a stream.',
    'You can report a listing from its menu. We may remove content, end live streams, and limit or close accounts that break these rules.',
  ]),
  TermsSection('9. Your content', [
    'You own the photos, videos and text you post. You give Dobha Dobha permission to show them in the app and on our website so we can run the marketplace, including showing your listings to other users.',
    'Only post content you have the right to use.',
  ]),
  TermsSection('10. Privacy', [
    'We collect what we need to run Dobha Dobha: your name, username, email address and phone number, your profile, delivery addresses you enter, your listings, orders, offers, messages, comments and live stream activity, and basic device and usage information.',
    'We use it to run your account, deliver notifications, keep the marketplace safe, and handle questions. Existing historical records may include order, wallet, or delivery details. We do not sell your personal information.',
    'We protect your information under the Protection of Personal Information Act (POPIA). You can ask to see, correct or delete your personal information, subject to records we must keep by law, such as order history.',
  ]),
  TermsSection('11. Our responsibility', [
    'We work to keep Dobha Dobha running and safe, but we cannot promise it will always be available or free of errors. As far as the law allows, we are not responsible for losses caused by other users or by things outside our reasonable control.',
  ]),
  TermsSection('12. Changes to these terms', [
    'We may update these terms. When we make important changes we will tell you in the app, and you may need to accept the new terms to keep using Dobha Dobha.',
  ]),
  TermsSection('13. Law and contact', [
    'These terms are governed by the laws of the Republic of South Africa.',
    'If you have a question about these terms or your information, contact Dobha Dobha support.',
  ]),
];
