import { describe, expect, it } from 'vitest'
import { isLocalForwardedFor, isLocalHostHeader, isLocalRequest, isLoopbackAddress } from '../../server/lib/local-admin'

describe('administration locale', () => {
  it('reconnaît les adresses de loopback IPv4 / IPv6', () => {
    expect(isLoopbackAddress('127.0.0.1')).toBe(true)
    expect(isLoopbackAddress('::1')).toBe(true)
    expect(isLoopbackAddress('::ffff:127.0.0.1')).toBe(true)
    expect(isLoopbackAddress('192.168.1.20')).toBe(false)
    expect(isLoopbackAddress('::ffff:10.0.0.5')).toBe(false)
    expect(isLoopbackAddress(undefined)).toBe(false)
  })

  it('n\'accepte qu\'un en-tête Host local (protection DNS rebinding)', () => {
    expect(isLocalHostHeader('localhost:3000')).toBe(true)
    expect(isLocalHostHeader('127.0.0.1:3000')).toBe(true)
    expect(isLocalHostHeader('[::1]:3000')).toBe(true)
    expect(isLocalHostHeader('evil.example')).toBe(false)
    expect(isLocalHostHeader('localhost.evil.example')).toBe(false)
    expect(isLocalHostHeader('192.168.1.20:3000')).toBe(false)
  })

  it('combine socket, X-Forwarded-For et Host', () => {
    // Accès direct (socket local)
    expect(isLocalRequest({ socketIp: '127.0.0.1', host: 'localhost:3100' })).toBe(true)
    // Via le relais du serveur de dev (pas d'adresse de socket, IP réelle dans X-Forwarded-For)
    expect(isLocalRequest({ socketIp: null, forwardedFor: '::1', host: 'localhost:3100' })).toBe(true)
    expect(isLocalRequest({ socketIp: null, forwardedFor: '192.168.1.20', host: 'localhost:3100' })).toBe(false)
    expect(isLocalRequest({ socketIp: null, forwardedFor: null, host: 'localhost:3100' })).toBe(false)
    expect(isLocalRequest({ socketIp: '192.168.1.20', host: 'localhost:3100' })).toBe(false)
    expect(isLocalRequest({ socketIp: '127.0.0.1', host: 'evil.example' })).toBe(false)
  })

  it('refuse une chaîne X-Forwarded-For contenant une adresse externe', () => {
    expect(isLocalForwardedFor(undefined)).toBe(true)
    expect(isLocalForwardedFor('127.0.0.1')).toBe(true)
    expect(isLocalForwardedFor('127.0.0.1, 203.0.113.9')).toBe(false)
  })
})
