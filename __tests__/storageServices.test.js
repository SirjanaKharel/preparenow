import { storageService } from '../src/services/storageServices';

describe('storageService', () => {
  it('should save and get preferences', async () => {
    const prefs = { theme: 'dark' };
    await storageService.savePreferences(prefs);
    const result = await storageService.getPreferences();
    expect(result.success).toBe(true);
    expect(result.data).toEqual(prefs);
  });

  it('should save and get emergency contacts', async () => {
    const contacts = [{ name: 'Test', phone: '123' }];
    await storageService.saveEmergencyContacts(contacts);
    const result = await storageService.getEmergencyContacts();
    expect(result.success).toBe(true);
    expect(result.data).toEqual(contacts);
  });
});