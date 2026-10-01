/// Dobha Dobha's Terms and Conditions, shown in the app and accepted when registering.
///
/// Bump [termsVersion] whenever the text changes in a way users should agree to again;
/// the server records which version each account accepted.
library;

const termsVersion = '2026-10-01';
const termsUpdated = '1 October 2026';

class TermsSection {
  final String title;
  final List<String> paragraphs;
  const TermsSection(this.title, this.paragraphs);
}

const termsSections = [
  TermsSection('1. Agreeing to these terms', [
    'These terms are an agreement between you and Dobha Dobha. By creating an account or using the app, you agree to them. If you do not agree, please do not use Dobha Dobha.',
    'Dobha Dobha is a marketplace. We connect people buying and selling second-hand and thrift clothing. Unless we say otherwise, the seller of a piece is the person or stall that listed it, not Dobha Dobha.',
  ]),
  TermsSection('2. Your account', [
    'You must be 18 or older, or have a parent or guardian\'s permission, to use Dobha Dobha.',
    'Give us true details when you sign up, keep your password private, and tell us straight away if you think someone else is using your account. You are responsible for what happens on your account.',
    'You may have one personal account. We may suspend or close accounts that break these terms.',
  ]),
  TermsSection('3. Buying', [
    'Thrift pieces are usually pre-owned. Look carefully at the photos, size, condition and description before you buy, and ask the seller in chat if anything is unclear.',
    'Prices are in South African rand. The total you pay is the price plus the delivery fee for the option you choose, shown before you pay.',
    'When you pay, we hold the money and only pay the seller once you confirm you received the piece as described. Please check it and confirm, or report a problem, soon after it arrives.',
    'Each purchase is a separate order with its own seller, even when you check out several pieces from your cart together.',
  ]),
  TermsSection('4. Selling', [
    'You can sell once you add your shop name and stall location. You must own what you list and have the right to sell it.',
    'Listings must be honest: real photos of the actual piece, the correct size and condition, and any flaws described. The quantity you list must be what you actually have.',
    'Once a piece sells, send it promptly (we expect within 3 business days) and add the courier tracking number when you mark it as sent, unless the buyer collects it at the Safe Hub.',
    'You are paid when the buyer confirms they received the piece. Dobha Dobha keeps a fee of 5% of the item price from each sale. Delivery fees are not part of your payout.',
  ]),
  TermsSection('5. Offers', [
    'Buyers can offer a lower price and sellers can accept, decline or counter. When an offer or counter is accepted, the buyer may buy the piece at that price within 48 hours, and the seller agrees to sell at that price during that time.',
  ]),
  TermsSection('6. Payments, payouts and problems', [
    'Payment is taken through the payment option you choose in the app. Money held for an order is released to the seller when the buyer confirms, or as decided by Dobha support if there is a problem.',
    'If something is wrong with an order, report a problem from the order before you confirm it. The money stays on hold while Dobha support looks into it with you and the other person. Support may refund the buyer or pay the seller depending on what happened, and will tell you both.',
    'Withdrawals go to the South African bank account you give us. Make sure the details are correct.',
    'Nothing in these terms takes away your rights under the Consumer Protection Act or other South African law.',
  ]),
  TermsSection('7. Things you may not sell', [
    'Counterfeit or fake branded goods, stolen goods, weapons, drugs, alcohol, tobacco and vaping products, adult content, used underwear or swimwear that has not been washed, items that are recalled or unsafe, and anything else that is illegal to sell in South Africa.',
  ]),
  TermsSection('8. Live streams, chat and comments', [
    'Be respectful. Harassment, threats, hate speech, sexual content, spam and scams are not allowed in live streams, chats, comments or listings.',
    'Do not share other people\'s personal information, and keep payments inside Dobha Dobha. Deals taken off the app are not protected by our payment hold or support.',
    'You can report a listing from its menu. We may remove content, end live streams, and limit or close accounts that break these rules.',
  ]),
  TermsSection('9. Your content', [
    'You own the photos, videos and text you post. You give Dobha Dobha permission to show them in the app and on our website so we can run the marketplace, including showing your listings to other users.',
    'Only post content you have the right to use.',
  ]),
  TermsSection('10. Privacy', [
    'We collect what we need to run Dobha Dobha: your name, username, email address and phone number, your profile, delivery addresses you enter, your listings, orders, offers, messages, comments and live stream activity, and basic device and usage information.',
    'We use it to run your account, process orders and payouts, deliver notifications, keep the marketplace safe, and handle problems. Sellers see the name and delivery address you give for their order so they can send it. We do not sell your personal information.',
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
