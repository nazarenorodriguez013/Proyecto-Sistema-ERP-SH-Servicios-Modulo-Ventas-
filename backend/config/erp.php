<?php

return [
    'jwt_secret' => env('JWT_SECRET', env('APP_KEY')),
    'google_client_id' => env('GOOGLE_CLIENT_ID'),
    'resend_key' => env('RESEND_API_KEY'),
    'mail_from' => env('MAIL_FROM', 'SH Servicios <onboarding@resend.dev>'),
    'mails_log' => env('MAILS_LOG'),
];
