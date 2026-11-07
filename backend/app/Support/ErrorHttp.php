<?php

namespace App\Support;

use RuntimeException;

// Error con un mensaje pensado para el usuario y el código HTTP que corresponde
class ErrorHttp extends RuntimeException
{
    public function __construct(public int $status, string $mensaje)
    {
        parent::__construct($mensaje);
    }
}
