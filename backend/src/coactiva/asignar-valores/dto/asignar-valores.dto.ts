import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsInt } from 'class-validator';

export class AsignarValoresDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsInt({ each: true })
  valorIds: number[];

  @IsInt()
  auxiliarId: number;
}
