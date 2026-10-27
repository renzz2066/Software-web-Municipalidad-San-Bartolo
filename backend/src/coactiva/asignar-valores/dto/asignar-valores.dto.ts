import { IsArray, IsInt, IsNotEmpty } from 'class-validator';

export class AsignarValoresDto {
  @IsArray()
  @IsInt({ each: true })
  @IsNotEmpty()
  valorIds: number[];

  @IsInt()
  @IsNotEmpty()
  auxiliarId: number;
}
