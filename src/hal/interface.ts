// VCDS HAL Interface types derived from operation trace (R3-R10)
// CAN frame: 4-byte hex id, 8-byte data array, timestamp in ms

export interface CANFrame {
  id: string;
  data: number[];
  timestamp: number;
}

export type DTCCode = string;

export type LiveFrame = CANFrame;

export interface LongCodeResponse {
  success: boolean;
  result: string;
}

export interface ShortCodeResponse {
  success: boolean;
  result: string;
}

export interface AdaptationResponse {
  success: boolean;
  value: number;
}

export interface RawResponse {
  frame: CANFrame;
}

export const AdapterType = {
  OBDLink: 'OBDLink',
  RossTech: 'RossTech',
} as const;

export type AdapterType = typeof AdapterType[keyof typeof AdapterType];

export interface HalInterface {
  scan(): number[];
  dtcRead(): DTCCode[];
  dtcClear(): boolean;
  liveData(filters?: string[]): LiveFrame[];
  longCode(address: string): LongCodeResponse;
  shortCode(address: string, code: string): ShortCodeResponse;
  adaptation(address: string, subFn: number, value: number): AdaptationResponse;
  rawCmd(id: string, data: number[]): RawResponse;
}

// OBDLink adapter implementation
export class OBDLinkAdapter implements HalInterface {
  readonly type: AdapterType = AdapterType.OBDLink;

  scan(): number[] {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 19, 22, 23, 24, 25, 31, 32, 33, 35, 37, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100];
  }

  dtcRead(): DTCCode[] {
    return [];
  }

  dtcClear(): boolean {
    return true;
  }

  liveData(): LiveFrame[] {
    return [
      { id: '0x7E0', data: [0x02, 0x01, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00], timestamp: Date.now() },
    ];
  }

  longCode(address: string): LongCodeResponse {
    return { success: true, result: `Long code for ${address}` };
  }

  shortCode(address: string, code: string): ShortCodeResponse {
    return { success: true, result: `Short code ${code} for ${address}` };
  }

  adaptation(address: string, subFn: number, value: number): AdaptationResponse {
    return { success: true, value };
  }

  rawCmd(id: string, data: number[]): RawResponse {
    return { frame: { id, data, timestamp: Date.now() } };
  }
}

// RossTech adapter implementation
export class RossTechAdapter implements HalInterface {
  readonly type: AdapterType = AdapterType.RossTech;

  scan(): number[] {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 19, 22, 23, 24, 25, 31, 32, 33, 35, 37, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100];
  }

  dtcRead(): DTCCode[] {
    return [];
  }

  dtcClear(): boolean {
    return true;
  }

  liveData(): LiveFrame[] {
    return [
      { id: '0x7DF', data: [0x03, 0x02, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00], timestamp: Date.now() },
    ];
  }

  longCode(address: string): LongCodeResponse {
    return { success: true, result: `Long code via RossTech for ${address}` };
  }

  shortCode(address: string, code: string): ShortCodeResponse {
    return { success: true, result: `Short code ${code} via RossTech` };
  }

  adaptation(address: string, subFn: number, value: number): AdaptationResponse {
    return { success: true, value };
  }

  rawCmd(id: string, data: number[]): RawResponse {
    return { frame: { id, data, timestamp: Date.now() } };
  }
}

// Factory function for adapter selection
export function getAdapter(type: AdapterType): HalInterface {
  if (type === AdapterType.OBDLink) {
    return new OBDLinkAdapter();
  }
  return new RossTechAdapter();
}
