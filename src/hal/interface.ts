// VCDS HAL Interface types derived from operation trace (R3-R10)
// CAN frame: 4-byte hex id, 8-byte data array, timestamp in ms

export interface CANFrame {
  id: string;
  data: number[];
  timestamp: number;
}

export type DTCCode = number;

export type ScanResult = { count: number; names: number[] };

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

// Adapter type constant for factory pattern
export const AdapterType = {
  OBDLink: 'OBDLink',
  RossTech: 'RossTech',
} as const;

export type AdapterTypeValue = (typeof AdapterType)[keyof typeof AdapterType];

export interface HalInterface {
  scan(): ScanResult;
  dtcRead(): DTCCode[];
  dtcClear(): boolean;
  liveData(pids?: string[]): CANFrame[];
  longCode(address: string, block?: number, value?: string): LongCodeResponse;
  shortCode(address: string, code: string, value?: number): ShortCodeResponse;
  adaptation(address: string, channel?: number, value?: number): AdaptationResponse;
  rawCmd(id?: string, data?: number[]): RawResponse;
}

// OBDLink adapter
export class OBDLinkAdapter implements HalInterface {
  readonly type: AdapterTypeValue = AdapterType.OBDLink;

  scan(): ScanResult {
    const names: number[] = [];
    for (let i = 1; i <= 100; i++) {
      names.push(i);
    }
    return { count: names.length, names };
  }

  dtcRead(): DTCCode[] {
    return [];
  }

  dtcClear(): boolean {
    return true;
  }

  liveData(pids?: string[]): CANFrame[] {
    if (!pids || pids.length === 0) {
      return [
        { id: '0x7E0', data: [0x02, 0x01, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00], timestamp: Date.now() },
      ];
    }
    return pids.map((pid) => ({
      id: pid,
      data: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
      timestamp: Date.now(),
    }));
  }

  longCode(_address: string, _block?: number, _value?: string): LongCodeResponse {
    return { success: true, result: String(_address) };
  }

  shortCode(_address: string, _code: string, _value?: number): ShortCodeResponse {
    return { success: true, result: String(_code) };
  }

  adaptation(_address: string, _channel?: number, value?: number): AdaptationResponse {
    return { success: true, value: value ?? 0 };
  }

  rawCmd(id?: string, data?: number[]): RawResponse {
    return {
      frame: {
        id: id ?? '',
        data: data ?? [],
        timestamp: Date.now(),
      },
    };
  }
}

// RossTech adapter
export class RossTechAdapter implements HalInterface {
  readonly type: AdapterTypeValue = AdapterType.RossTech;

  scan(): ScanResult {
    const names: number[] = [];
    for (let i = 1; i <= 100; i++) {
      names.push(i);
    }
    return { count: names.length, names };
  }

  dtcRead(): DTCCode[] {
    return [];
  }

  dtcClear(): boolean {
    return true;
  }

  liveData(pids?: string[]): CANFrame[] {
    if (!pids || pids.length === 0) {
      return [
        { id: '0x7E0', data: [0x02, 0x01, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00], timestamp: Date.now() },
      ];
    }
    return pids.map((pid) => ({
      id: pid,
      data: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00],
      timestamp: Date.now(),
    }));
  }

  longCode(_address: string, _block?: number, _value?: string): LongCodeResponse {
    return { success: true, result: String(_address) };
  }

  shortCode(_address: string, _code: string, _value?: number): ShortCodeResponse {
    return { success: true, result: String(_code) };
  }

  adaptation(_address: string, _channel?: number, value?: number): AdaptationResponse {
    return { success: true, value: value ?? 0 };
  }

  rawCmd(id?: string, data?: number[]): RawResponse {
    return {
      frame: {
        id: id ?? '',
        data: data ?? [],
        timestamp: Date.now(),
      },
    };
  }
}

// Factory function for adapter selection
export function getAdapter(type: AdapterTypeValue | null | undefined): HalInterface {
  if (type === AdapterType.OBDLink) {
    return new OBDLinkAdapter();
  }
  return new RossTechAdapter();
}
