/// What a support question is about. [id] matches the server's topic list.
class SupportTopic {
  final String id;
  final String label;
  const SupportTopic(this.id, this.label);
}

const supportTopics = [
  SupportTopic('order', 'An order'),
  SupportTopic('payment', 'Payments or wallet'),
  SupportTopic('selling', 'Selling'),
  SupportTopic('account', 'My account'),
  SupportTopic('safety', 'Safety or a scam'),
  SupportTopic('bug', 'Something is not working'),
  SupportTopic('other', 'Something else'),
];

String supportTopicLabel(String id) => supportTopics.firstWhere((t) => t.id == id, orElse: () => supportTopics.last).label;

/// A question sent to Dobha support, and the answer once there is one.
class SupportRequest {
  final String id;
  final String topic;
  final String message;
  final String? orderId;

  /// open, answered or closed.
  final String status;
  final String? reply;
  final DateTime? repliedAt;
  final DateTime createdAt;

  const SupportRequest({
    required this.id,
    required this.topic,
    required this.message,
    this.orderId,
    required this.status,
    this.reply,
    this.repliedAt,
    required this.createdAt,
  });

  bool get isOpen => status == 'open';

  factory SupportRequest.fromJson(Map<String, dynamic> json) => SupportRequest(
        id: json['id'] as String,
        topic: json['topic'] as String,
        message: json['message'] as String,
        orderId: json['orderId'] as String?,
        status: json['status'] as String,
        reply: json['reply'] as String?,
        repliedAt: json['repliedAt'] == null ? null : DateTime.parse(json['repliedAt'] as String),
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}
