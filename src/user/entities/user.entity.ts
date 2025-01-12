import { BeforeInsert, Column, Entity } from 'typeorm';
import { BaseModel } from '../../models';
import { StatusEnum, statusEnum } from '../constants';
import * as argon2 from 'argon2';
@Entity('users') // Table name
export class User extends BaseModel {
  @Column({ type: 'varchar', length: 255 })
  firstName: string;

  @Column({ type: 'varchar', length: 255 })
  lastName: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 15 })
  phone: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  profilePicture: string;

  @Column({
    type: 'enum',
    enum: statusEnum,
    default: statusEnum.STAFF,
  })
  type: StatusEnum;

  @BeforeInsert()
  async hashPassword() {
    this.password = await argon2.hash(this.password);
  }

  constructor(partial: Partial<User>) {
    super();
    Object.assign(this, partial);
  }
}
