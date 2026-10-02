package com.dobhadobha.dobha_live

import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity

class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // The channel push notifications arrive on (the server sends channel_id "dobha").
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel("dobha", "Orders and messages", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Sales, deliveries, payouts, offers, chat messages and support answers"
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }
}
