/// Dobha Dobha's Privacy Policy, shown in the app and linked from Settings.
library;

import 'terms.dart';

const privacyUpdated = '2 October 2026';

const privacySections = [
  TermsSection('1. Who we are', [
    'Dobha Dobha is a South African marketplace for second-hand and thrift clothing. This policy explains what personal information we collect, why, and the choices you have. We follow the Protection of Personal Information Act (POPIA).',
  ]),
  TermsSection('2. What we collect', [
    'Account details: your name, username, email address, phone number if you give it, password (stored only in a scrambled form we cannot read), and your Google account id if you use Continue with Google.',
    'Profile and shop details: your picture, bio, area, shop name and stall location.',
    'Marketplace activity: listings and their photos and videos, likes, saves, comments, offers, carts, follows, reviews, chats, live streams you host or watch, and reports you make.',
    'Orders and money: what you buy and sell, delivery addresses, the payment option you choose, wallet activity, and the bank account details you give for withdrawals.',
    'Support: questions you send us and our answers.',
    'Technical information: your IP address and basic device and app information, used to keep the service secure and working.',
  ]),
  TermsSection('3. How we use it', [
    'To run your account and the marketplace: showing listings, processing orders, holding and releasing payments, payouts, notifications and chat.',
    'To keep people safe: preventing fraud and abuse, limiting repeated requests, reviewing reports and settling problems with orders.',
    'To answer you when you contact support, and to tell you about important changes such as updates to our terms.',
    'We do not sell your personal information, and we do not use it for advertising by other companies.',
  ]),
  TermsSection('4. Who can see it', [
    'Other users see your public profile: name, username, picture, bio, area, shop details, listings, reviews and follower counts.',
    'When you buy, the seller sees your name and the delivery address for that order so they can send it.',
    'We use service providers to run Dobha Dobha, such as Cloudflare (hosting, database and file storage), LiveKit (live streaming), Google (Continue with Google) and payment and delivery partners. They only get what they need to do that job.',
    'We may share information when the law requires it, or to protect people from fraud or harm.',
  ]),
  TermsSection('5. How long we keep it', [
    'We keep your information while your account is open. When you delete your account, we remove your profile, picture, listings that never sold, likes, saves, comments, carts, follows and notifications straight away.',
    'Records of orders and payments are kept, without your profile, for as long as South African law requires, so the other person in each order still has a record of it.',
  ]),
  TermsSection('6. Your rights', [
    'You can see and correct most of your information yourself under Me, then Edit profile.',
    'You can delete your account at any time under Me, then Settings, once your orders are finished and your wallet is empty.',
    'You can ask us what information we hold about you, ask us to correct or delete it, or object to how we use it, by using Contact support in the app.',
    'If you are unhappy with how we handle your information, you may complain to the Information Regulator of South Africa.',
  ]),
  TermsSection('7. Security', [
    'We protect your information with encrypted connections, scrambled passwords and sign-in tokens, and limits on repeated attempts. No system is perfect, so please use a strong password you do not use elsewhere.',
  ]),
  TermsSection('8. Children', [
    'Dobha Dobha is for people 18 and older, or younger people with a parent or guardian\'s permission. We do not knowingly collect information from children without that permission.',
  ]),
  TermsSection('9. Changes and contact', [
    'We may update this policy. When we make important changes we will tell you in the app.',
    'Questions about your privacy? Use Contact support in the app and pick My account.',
  ]),
];
