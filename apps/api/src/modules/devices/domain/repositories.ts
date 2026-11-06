import type { Device } from './device.js';
import type { Pairing } from './pairing.js';

/** Ports of the devices context. They run in the current tenant transaction (RLS). */
export interface DeviceRepository {
  findById(id: string, options?: { forUpdate?: boolean }): Promise<Device | undefined>;
  /** Newest first. */
  list(): Promise<Device[]>;
  count(): Promise<number>;
  add(device: Device): Promise<void>;
  save(device: Device): Promise<void>;
}

export interface PairingRepository {
  findById(id: string, options?: { forUpdate?: boolean }): Promise<Pairing | undefined>;
  /** Inserts; false when another pending pairing already uses the same code. */
  add(pairing: Pairing): Promise<boolean>;
  save(pairing: Pairing): Promise<void>;
}

/** Who goes to the field with each survey: devices and interviewers. */
export interface TeamRepository {
  of(surveyId: string): Promise<{ deviceIds: string[]; interviewerIds: string[] }>;
  replace(input: {
    surveyId: string;
    deviceIds: readonly string[];
    interviewerIds: readonly string[];
    by: string;
    now: Date;
  }): Promise<void>;
  /** Survey ids per device id. */
  surveysByDevice(): Promise<ReadonlyMap<string, string[]>>;
  removeDevice(deviceId: string): Promise<void>;
}
