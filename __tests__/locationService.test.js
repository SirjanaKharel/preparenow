import * as locationService from '../src/services/locationService';

describe('locationService', () => {
  it('should subscribe and unsubscribe to location changes', () => {
    const cb = jest.fn();
    const unsub = locationService.subscribeToLocationChanges(cb);
    expect(typeof unsub).toBe('function');
    unsub();
    // No error should occur
  });

  it('should subscribe and unsubscribe to event changes', () => {
    const cb = jest.fn();
    const unsub = locationService.subscribeToEventChanges(cb);
    expect(typeof unsub).toBe('function');
    unsub();
  });

  it('should subscribe and unsubscribe to disaster zones', () => {
    const cb = jest.fn();
    const unsub = locationService.subscribeToDisasterZones(cb);
    // unsub may be null if error, but should not throw
    if (unsub) unsub();
  });

  it('should unsubscribe from disaster zones without error', () => {
    expect(() => locationService.unsubscribeFromDisasterZones()).not.toThrow();
  });
});