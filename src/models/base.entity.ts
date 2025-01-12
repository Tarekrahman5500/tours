import {
  BaseEntity,
  Column,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export abstract class BaseModel extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string; // Primary key with UUID

  @Column({ type: 'int', generated: 'increment', unique: true })
  uid: number; // Auto-increment unique column
  @CreateDateColumn({
    type: 'timestamp with time zone',
    default: () => `CURRENT_TIMESTAMP AT TIME ZONE '+6'`,
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp with time zone', // Specify the data type with time zone
    default: () => `CURRENT_TIMESTAMP AT TIME ZONE '+6'`,
    onUpdate: `CURRENT_TIMESTAMP AT TIME ZONE '+6'`, // Set the onUpdate value with the desired time zone offset
  })
  updatedAt: Date | null;
}
