const fmt = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Saldo positivo = el cliente debe; negativo = pagó de más o dejó un anticipo (saldo a favor)
export const describirSaldo = (saldo: number) =>
  saldo > 0 ? { texto: `Debe $${fmt(saldo)}`, color: '#C6402F' }
    : saldo < 0 ? { texto: `A favor $${fmt(-saldo)}`, color: '#1E7A45' }
      : { texto: 'Al día', color: '#6B6B6B' }
